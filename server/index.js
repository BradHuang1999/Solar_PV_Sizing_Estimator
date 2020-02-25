const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const util = require('util');
const cp = require('child_process');

const app = express();

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

const exec = util.promisify(cp.exec);

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
                            pv_kw: parseFloat(output_sim_str[0]),
                            battery_kwh: parseFloat(output_sim_str[1]),
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
                            pv_kw: parseFloat(output_snc_str[0]),
                            battery_kwh: parseFloat(output_snc_str[1]),
                            total_cost: parseFloat(output_snc_str[2])
                        }
                    }
                }

                resolve(msg);
            })
            .catch(reason => {
                let msg = {
                    type: type,
                    sim: {
                        success: 0,
                        value: reason
                    },
                    snc: {
                        success: 0,
                        value: reason
                    }
                }

                resolve(msg);
            });
    });
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
        load_text,
        pv_text
    } = req.body;

    load_text = load_text.trim();
    pv_text = pv_text.trim();

    load_len = load_text.split("\n").length;
    pv_len = pv_text.split("\n").length;

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
        load_len,
        pv_len
    )

    let msg = {};

    function spawn_promise(exec_binary_command, estimation_zero_one) {
        return new Promise((resolve, reject) => {
            let args = []

            args.push(pv_price_per_kw);
            args.push(battery_price_per_kwh);

            if (estimation_zero_one) {
                args.push(estimation_zero_one);
            }

            args.push(epsilon_target);
            args.push(confidence_level);
            args.push(days_in_sample);

            if (pv_input_type === "input_file") {
                args.push("--");
                args.push(load_len);
                args.push("--");
                args.push(pv_len);
            } else {
                args.push("estimation_compiled/load.txt");
                args.push("estimation_compiled/pv.txt");
            }

            let child = cp.spawn(exec_binary_command, args);

            if (pv_input_type === "input_file") {
                child.stdin.write(load_text + "\n" + pv_text + "\n");
            }

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

    if (estimation_type === 'lolp') {

        promise_sim = spawn_promise("./estimation_compiled/sim", "0");
        promise_snc = spawn_promise("./estimation_compiled/snc_lolp");

        msg = await process_input('lolp', promise_sim, promise_snc);

    } else if (estimation_type == 'eue') {

        promise_sim = spawn_promise("./estimation_compiled/sim", "1");
        promise_snc = spawn_promise("./estimation_compiled/snc_eue");

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
