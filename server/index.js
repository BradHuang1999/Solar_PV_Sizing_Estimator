const axios = require('axios');
const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const cp = require('child_process');

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

function ab2str(buf) {
    return String.fromCharCode.apply(null, new Uint16Array(buf));
}

function process_input(type, promise_sim, promise_snc) {
    return new Promise(resolve => {
        Promise
            .all([promise_sim, promise_snc])
            .then(results => {
                const output_sim = results[0];
                const output_snc = results[1];
                
                let msg = {
                    type: type,
                    sim: {},
                    snc: {}
                };

                if (output_sim.stderr) {
                    msg.sim = {
                        success: 0,
                        value: output_sim.stderr
                    }
                } else {
                    output_sim_str = output_sim.stdout.split("\t");

                    msg.sim = {
                        success: 1,
                        value: {
                            battery_kwh: parseFloat(output_sim_str[0]),
                            pv_kw: parseFloat(output_sim_str[1]),
                            total_cost: parseFloat(output_sim_str[2])
                        }
                    }
                }

                if (output_snc.stderr) {
                    msg.snc = {
                        success: 0,
                        value: output_snc.stderr
                    }
                } else {
                    output_snc_str = output_snc.stdout.split("\t");

                    msg.snc = {
                        success: 1,
                        value: {
                            battery_kwh: parseFloat(output_snc_str[0]),
                            pv_kw: parseFloat(output_snc_str[1]),
                            total_cost: parseFloat(output_snc_str[2])
                        }
                    }
                }

                resolve(msg);
            })
            .catch(reason => {
                let msg = {
                    type: 'error',
                    reason: reason
                }

                resolve(msg);
            });
    });
}

function get_pv_watts_metrics(lat, lon, pv_tilt, pv_azimuth, pv_module_type, pv_array_type, pv_losses, data_type) {
    pv_watts_params = {
        api_key: "K3qAWw3MrlOi0CHKtYrI3JeQjnsdsfq50OLULCiD",
        system_capacity: 1,
        losses: pv_losses,
        lat: lat,
        lon: lon,
        module_type: pv_module_type,
        array_type: pv_array_type,
        tilt: pv_tilt,
        azimuth: pv_azimuth,
        timeframe: 'hourly'
    };

    function get_axios_pv_watts_promise(dataset) {
        return axios.get(`https://developer.nrel.gov/api/pvwatts/v6.json?dataset=${dataset}`, {params: pv_watts_params});
    }

    return get_axios_pv_watts_promise(data_type);
}

app.post('/', async (req, res) => {

    let {
        estimation_type,
        pv_price_per_kw,
        battery_price_per_kwh,
        epsilon_target,
        confidence_level,
        days_in_sample,
        pv_input_type,
        lat,
        lon,
        pv_tilt,
        pv_azimuth,
        pv_module_type,
        pv_array_type,
        pv_losses,
        load_text,
        pv_text,
    } = req.body;

    if (load_text) {
        load_text = load_text.trim();
        load_len = load_text.split("\n").length;
    }

    if (pv_text) {
        pv_text = pv_text.trim();
        pv_len = pv_text.split("\n").length;
    }

    let msg = {};

    function spawn_promise(exec_binary_command, estimation_zero_one) {
        console.log(
            estimation_type,
            pv_price_per_kw,
            battery_price_per_kwh,
            epsilon_target,
            confidence_level,
            days_in_sample,
            pv_input_type,
            lat,
            lon,
            pv_tilt,
            pv_azimuth,
            pv_module_type,
            pv_array_type,
            pv_losses,
            load_len,
            pv_len,
        );

        return new Promise(resolve => {
            let args = []

            args.push(pv_price_per_kw);
            args.push(battery_price_per_kwh);

            if (estimation_zero_one) {
                args.push(estimation_zero_one);
            }

            args.push(epsilon_target);
            args.push(confidence_level);
            args.push(days_in_sample);

            args.push("--");
            args.push(load_len);
            args.push("--");
            args.push(pv_len);

            let child = cp.spawn(exec_binary_command, args);

            child.stdin.write(load_text + "\n" + pv_text + "\n");

            child.stdout.on('data', function (data_buffer) {
                resolve({
                    stdout: ab2str(data_buffer)
                });
            });

            child.stderr.on('data', function (data_buffer) {
                resolve({
                    stderr: ab2str(data_buffer)
                });
            });
        });
    }

    let pv_watts_data, ac;

    if (pv_input_type === 'lat_lon') {
        try {
            pv_watts_data = await get_pv_watts_metrics(lat, lon, pv_tilt, pv_azimuth, pv_module_type, pv_array_type, pv_losses, "tmy3");
            ac = pv_watts_data.data.outputs.ac;

            pv_len = ac.length;
            pv_text = ac.map(w => (w / 1000).toFixed(8)).join('\n');
        } catch(err) {
            let msg = {
                type: 'no_pv_watts_data',
                input: {
                    lat: lat,
                    lon: lon
                }
            }

            res.send(msg);
        }
    }

    if (estimation_type === 'lolp') {

        promise_sim = spawn_promise("./bin/Robust_Sizing/sim", "0");
        promise_snc = spawn_promise("./bin/Robust_Sizing/snc_lolp");

        msg = await process_input('lolp', promise_sim, promise_snc);

    } else if (estimation_type == 'eue') {

        promise_sim = spawn_promise("./bin/Robust_Sizing/sim", "1");
        promise_snc = spawn_promise("./bin/Robust_Sizing/snc_eue");

        msg = await process_input('eue', promise_sim, promise_snc);

    } else {
        msg = { type: 'bad_parameter' };
    }

    console.log(msg);
    res.send(msg);
});

app.listen(8000, () => {
    console.log('App listening on port 8000!')
});
