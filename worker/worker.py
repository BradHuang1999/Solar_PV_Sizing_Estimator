from os import environ
import sys
import numpy as np
import json
import asyncio
import aiohttp
from asyncio.subprocess import create_subprocess_shell, PIPE
from load_trace_model.simulate_models import KnnARIMAModelSimulator

############################## BEGIN:CONSTANTS ##############################
BINARY_FOLDER = environ.get("ROBUST_SIZING_BINARY_PATH")
SIM = "sim"
SNC_LOLP = "snc_lolp"
SNC_EUE = "snc_eue"

PVWATTS_URL = "https://developer.nrel.gov/api/pvwatts/v6.json"
PVWATTS_APIKEY = environ.get("PVWATTS_APIKEY")
PVWATTS_SYSTEM_CAPACITY = 1
PVWATTS_TIMEFRAME = "hourly"
# PVWATTS_DATASETS = ["tmy2", "tmy3", "nsrdb", "intl"]

SIMULATE_NUM_LOAD_TRACE = 4
##############################  END:CONSTANTS  ##############################


async def run_simulate_load_trace(load_monthly_params):

    # print(f"starting run_simulate_load_trace")
    
    simulator = KnnARIMAModelSimulator(compress_pickle=False)
    gen_hourly = simulator.simulate_hourly_data(load_monthly_params, SIMULATE_NUM_LOAD_TRACE, False)
    
    # print(f"finishing run_simulate_load_trace")
    
    return gen_hourly


async def run_pv_watts(session, dataset_type, lat, lon, 
                       pv_losses, pv_module_type, pv_array_type, pv_tilt, pv_azimuth):

    # print(f"starting {dataset_type}")

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

        # print(f"finishing {dataset_type}")

        if result["errors"]:
            return {
                "success": 0,
                "error": result["errors"][0]
            }
        elif "ac" in result["outputs"]:
            return {
                "success": 1,
                "outputs": result["outputs"]
            }
        else:
            return {
                "success": 0,
                "error": "'ac' does not exist in outputs."
            }
    except Exception as ex:
        return {
            "success": 0,
            "error": ex
        }


async def run_trace_estimation(load_params, pv_params):

    async def id(i):
        return i

    async def get_pv_traces(pv_estimate_params):
        # print('starting get_pvwatts_solar_traces')

        async with aiohttp.ClientSession(connector=aiohttp.TCPConnector(ssl=False)) as session:
            results = await asyncio.gather(
                run_pv_watts(session, "tmy2", **pv_estimate_params),
                run_pv_watts(session, "tmy3", **pv_estimate_params),
                run_pv_watts(session, "nsrdb", **pv_estimate_params),
                run_pv_watts(session, "intl", **pv_estimate_params))

        ret = []
        for result in results:
            if (result["success"]) and ("ac" in result["outputs"]) and (len(result["outputs"]["ac"]) % 8760 == 0):
                for tr in result["outputs"]["ac"]:
                    ret.append(round(tr / 1000, 8))

        # print('finishing get_pvwatts_solar_traces')
        
        return ret

    # print('making load_coro')
    if load_params["isUsingLoadEstimation"] is True:
        load_coro = asyncio.create_task(run_simulate_load_trace(load_params["load_monthly_params"]))
    else:
        load_coro = asyncio.create_task(id(load_params["load_text"]))

    # print('making pv_coro')
    if pv_params["isUsingPVEstimation"] is True:
        pv_coro = asyncio.create_task(get_pv_traces(pv_params["pv_params"]))
    else:
        pv_coro = asyncio.create_task(id(pv_params["pv_text"]))

    pv_arr, load_arr = await asyncio.gather(pv_coro, load_coro)
    return (load_arr, pv_arr)


async def run_robust_sizing(method, estimation_type, pv_price_per_kw, battery_price_per_kwh,
                            epsilon_target, confidence_level, days_in_sample, load_arr, pv_arr):

    # print(f"starting {method}/{estimation_type}")
 
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
    
    p = await create_subprocess_shell(arg, stdin=PIPE, stdout=PIPE, stderr=PIPE)
    
    p_stdout, p_stderr = await p.communicate(stdin_args.encode())

    # print(f"finishing {method}/{estimation_type}")

    return p_stdout.decode(), p_stderr.decode()


async def main():

    input_data = json.loads(sys.stdin.read())

    load_list, pv_arr = await run_trace_estimation(input_data["load"], input_data["pv"])
    load_arr = np.hstack(load_list)

    result = await asyncio.gather(
        run_robust_sizing("sim", **input_data["sizing"], load_arr=load_arr, pv_arr=pv_arr),
        run_robust_sizing("snc", **input_data["sizing"], load_arr=load_arr, pv_arr=pv_arr)
    )

    if result[0][1] or result[1][1]:
        return {
            "success": 0,
            "sim": {
                "error": result[0][1]
            },
            "snc": {
                "error": result[1][1]
            }
        }
    else:
        sim = list(map(float, result[0][0].split('\t')))
        snc = list(map(float, result[1][0].split('\t')))
        return {
            "success": 1,
            "sim": {
                "battery_kwh": sim[0],
                "pv_kw": sim[1],
                "total_cost": sim[2]
            },
            "snc": {
                "battery_kwh": snc[0],
                "pv_kw": snc[1],
                "total_cost": snc[2]
            }
        }

print(json.dumps(asyncio.run(main())))
