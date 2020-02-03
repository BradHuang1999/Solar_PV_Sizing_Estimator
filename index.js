const express = require('express')
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

const util = require('util');
const exec = util.promisify(require('child_process').exec);

const cd_folder = 'cd estimation_compiled; ';

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

app.get('/', async (req, res) => {

    const {
        estimation_type,
        pv_price_per_kw,
        battery_price_per_kwh,
        epsilon_target,
        confidence_level,
        days_in_sample
    } = req.body;

    let msg = {};

    if (estimation_type === 'lolp') {
        input_sim = `${cd_folder} ./sim ${pv_price_per_kw} ${battery_price_per_kwh} 0 ${epsilon_target} ${confidence_level} ${days_in_sample} load.txt pv.txt;`
        promise_sim = exec(input_sim);

        input_snc = `${cd_folder} ./snc_lolp ${pv_price_per_kw} ${battery_price_per_kwh} ${epsilon_target} ${confidence_level} ${days_in_sample} load.txt pv.txt;`
        promise_snc = exec(input_snc);

        msg = await process_input('lolp', promise_sim, promise_snc);

    } else if (estimation_type == 'eue') {
        input_sim = `${cd_folder} ./sim ${pv_price_per_kw} ${battery_price_per_kwh} 1 ${epsilon_target} ${confidence_level} ${days_in_sample} load.txt pv.txt;`
        promise_sim = exec(input_sim);

        input_snc = `${cd_folder} ./snc_eue ${pv_price_per_kw} ${battery_price_per_kwh} ${epsilon_target} ${confidence_level} ${days_in_sample} load.txt pv.txt;`
        promise_snc = exec(input_snc);

        msg = await process_input('eue', promise_sim, promise_snc);

    } else {
        msg = {type: 'bad_parameter'};
    }

    console.log(msg);
    res.send(msg);
});

app.listen(8000, () => {
    console.log('App listening on port 8000!')
});
