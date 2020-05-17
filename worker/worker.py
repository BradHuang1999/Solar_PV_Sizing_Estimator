from os import environ
import sys
import numpy as np
import json
import logging
import asyncio
import aiohttp
from asyncio.subprocess import create_subprocess_shell, PIPE
from load_trace_model.simulate_models import KnnARIMAModelSimulator

############################## BEGIN:LOGGING ##############################
logging.basicConfig(level=logging.DEBUG, filename=environ.get("PV_LOG"), filemode="a", format="%(process)d - %(asctime)s - %(levelname)s - %(message)s")
##############################  END:LOGGING  ##############################

############################## BEGIN:CONSTANTS ##############################
BINARY_FOLDER = environ.get("ROBUST_SIZING_BINARY_PATH")
SIM = "sim"
SNC_LOLP = "snc_lolp"
SNC_EUE = "snc_eue"

PVWATTS_URL = "https://developer.nrel.gov/api/pvwatts/v6.json"
PVWATTS_APIKEY = environ.get("PVWATTS_APIKEY")
PVWATTS_SYSTEM_CAPACITY = 1
PVWATTS_TIMEFRAME = "hourly"
PVWATTS_DATASETS = ["tmy2", "tmy3", "nsrdb", "intl"]

SIMULATE_NUM_LOAD_TRACE = 4

SIZING_LOSS_TARGETS = [0.01, 0.05, 0.1, 0.15, 0.25, 0.5, 0.75]
##############################  END:CONSTANTS  ##############################


async def run_simulate_load_trace(load_monthly_params):

    logging.debug("starting run_simulate_load_trace")
    
    simulator = KnnARIMAModelSimulator(compress_pickle=False)
    gen_hourly = simulator.simulate_hourly_data(load_monthly_params, SIMULATE_NUM_LOAD_TRACE, False)
    
    logging.debug("finishing run_simulate_load_trace")
    
    return gen_hourly


async def run_pv_watts(session, dataset_type, lat, lon, 
                       pv_losses, pv_module_type, pv_array_type, pv_tilt, pv_azimuth):

    logging.debug(f"starting run_pv_watts with dataset_type={dataset_type}")

    params = {
        "api_key": str(PVWATTS_APIKEY),
        "system_capacity": str(PVWATTS_SYSTEM_CAPACITY),
        "losses": str(pv_losses),
        "lat": str(lat),
        "lon": str(lon),
        "module_type": str(pv_module_type),
        "array_type": str(pv_array_type),
        "tilt": str(pv_tilt),
        "azimuth": str(pv_azimuth),
        "timeframe": str(PVWATTS_TIMEFRAME),
        "dataset": str(dataset_type)
    }

    try:
        async with session.get(PVWATTS_URL, params=params) as resp:
            result = await resp.json()

        if result["errors"]:
            logging.debug(f"finishing run_pv_watts with dataset_type={dataset_type} - no data")
            return {
                "success": 0,
                "error": result["errors"][0]
            }
        elif "ac" in result["outputs"]:
            logging.debug(f"finishing run_pv_watts with dataset_type={dataset_type} - success")
            return {
                "success": 1,
                "outputs": result["outputs"]
            }
        else:
            logging.warning(f"finishing run_pv_watts with dataset_type={dataset_type} - 'ac' does not exist in outputs")
            return {
                "success": 0,
                "error": "'ac' does not exist in outputs."
            }
    except Exception as ex:
        logging.warning(f"finishing run_pv_watts with dataset_type={dataset_type} - exception {ex}")
        return {
            "success": 0,
            "error": ex
        }


async def run_trace_estimation(load_params, pv_params):

    async def id(i):
        return i

    async def get_pv_traces(pv_estimate_params):
        logging.debug('starting get_pvwatts_solar_traces')

        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
            tasks = [asyncio.create_task(run_pv_watts(session, dataset, **pv_estimate_params)) for dataset in PVWATTS_DATASETS]
            results = await asyncio.gather(*tasks)

        ret = []
        for result in results:
            if (result["success"]) and ("ac" in result["outputs"]):
                if len(result["outputs"]["ac"]) % 8760 == 0:
                    for tr in result["outputs"]["ac"]:
                        ret.append(round(tr / 1000, 8))
                else:
                    logging.warning(f'run_pv_watts returns illegal input, params={pv_estimate_params}')

        logging.debug('finishing get_pvwatts_solar_traces')
        
        return ret

    logging.debug('starting run_trace_estimation')

    if load_params["isUsingLoadEstimation"] is True:
        load_coro = asyncio.create_task(run_simulate_load_trace(load_params["load_monthly_params"]))
    else:
        load_coro = asyncio.create_task(id(load_params["load_text"]))

    if pv_params["isUsingPVEstimation"] is True:
        pv_coro = asyncio.create_task(get_pv_traces(pv_params["pv_params"]))
    else:
        pv_coro = asyncio.create_task(id(pv_params["pv_text"]))

    pv_arr, load_arr = await asyncio.gather(pv_coro, load_coro)

    logging.debug('finishing run_trace_estimation')

    return (load_arr, pv_arr)


async def run_robust_sizing(method, estimation_type, pv_price_per_kw, battery_price_per_kwh,
                            epsilon_target, confidence_level, days_in_sample, load_arr, pv_arr):

    logging.debug(f"starting run_robust_sizing, method={method}, estimation_type={estimation_type}, epsilon_target={epsilon_target}")
 
    load_len = len(load_arr)
    pv_len = len(pv_arr)

    args = []

    if method == "sim":
        args.append(BINARY_FOLDER + SIM)
    elif estimation_type == "lolp":
        args.append(BINARY_FOLDER + SNC_LOLP)
    else:
        args.append(BINARY_FOLDER + SNC_EUE)

    args.append(pv_price_per_kw)

    args.append(battery_price_per_kwh)

    if method == "sim":
        if estimation_type == "lolp":
            args.append(0)
        else:
            args.append(1)
    
    args.append(epsilon_target)

    args.append(confidence_level)

    args.append(days_in_sample)

    args.append("--")
    args.append(load_len)

    args.append("--")
    args.append(pv_len)

    arg = " ".join(map(str, args))
    stdin_args = "\n".join(map(str, load_arr)) + "\n" + "\n".join(map(str, pv_arr)) + "\n"
    
    logging.debug(f"create_subprocess_shell for run_robust_sizing, method={method}, estimation_type={estimation_type}, epsilon_target={epsilon_target}")

    p = await create_subprocess_shell(arg, stdin=PIPE, stdout=PIPE, stderr=PIPE)
    
    p_stdout, p_stderr = await p.communicate(stdin_args.encode())

    logging.debug(f"finishing run_robust_sizing, method={method}, estimation_type={estimation_type}, epsilon_target={epsilon_target}")

    return p_stdout.decode(), p_stderr.decode(), epsilon_target, arg, stdin_args


def parse_sizing_result(result):

    out, err, target, args, arrs = result

    if err:
        if out:
            return {
                "success": 0,
                "target": target,
                "args": args,
                "arrs": arrs,
                "error": err
            }
        else:
            return {
                "success": 0,
                "target": target,
                "args": args,
                "arrs": arrs,
                "stdout": out,
                "error": err
            }

    returns = list(map(float, out.split('\t')))

    return {
        "success": 1,
        "target": target,
        "battery_kwh": returns[0],
        "pv_kw": returns[1],
        "total_cost": returns[2]
    }


async def main():

    logging.info("MAIN: request starts")

    input_data = json.loads(sys.stdin.read())

    load_list, pv_arr = await run_trace_estimation(input_data["load"], input_data["pv"])
    load_arr = np.hstack(load_list)

    logging.info("MAIN: trace estimation done, starting robust_sizing")

    sizing_tasks = [asyncio.create_task(run_robust_sizing(
                        "sim", epsilon_target=target, **input_data["sizing"],
                        load_arr=load_arr, pv_arr=pv_arr))
                    for target in SIZING_LOSS_TARGETS]

    result = await asyncio.gather(*sizing_tasks)

    logging.info("MAIN: done")

    return list(map(parse_sizing_result, result))


print(json.dumps(asyncio.run(main())))
