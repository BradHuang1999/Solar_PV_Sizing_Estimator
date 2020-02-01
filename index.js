const express = require('express')
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

const util = require('util');
const exec = util.promisify(require('child_process').exec);

const cd_folder = 'cd estimation_compiled; ';

app.get('/', async (req, res) => {

    const {
        estimation_type,
        pv_price_per_kw,
        battery_price_per_kwh,
        epsilon_target,
        confidence_level,
        days_in_sample
    } = req.body;

    if (estimation_type === 'lolp') {
        input_sim = `${cd_folder} ./sim ${pv_price_per_kw} ${battery_price_per_kwh} 0 ${epsilon_target} ${confidence_level} ${days_in_sample} load.txt pv.txt;`
        promise_sim = exec(input_sim);

        input_snc = `${cd_folder} ./snc_lolp ${pv_price_per_kw} ${battery_price_per_kwh} ${epsilon_target} ${confidence_level} ${days_in_sample} load.txt pv.txt;`
        promise_snc = exec(input_snc);

        Promise
            .all([promise_sim, promise_snc])
            .then(results => {
                output_sim = results[0];
                output_snc = results[1];

                if (output_sim.stderr | output_snc.stderr) {
                    msg = "Something went wrong. Please try again or contact the administrator.";
                    console.log(msg);
                    res.send(msg);
                } else {
                    output_sim_str = output_sim.stdout.split("\t");
                    output_snc_str = output_snc.stdout.split("\t");

                    msg = {
                        type: 'lolp',
                        sim: {
                            pv_kw: parseFloat(output_sim_str[0]),
                            battery_kwh: parseFloat(output_sim_str[1]),
                            total_cost: parseFloat(output_sim_str[2])
                        },
                        snc: {
                            pv_kw: parseFloat(output_snc_str[0]),
                            battery_kwh: parseFloat(output_snc_str[1]),
                            total_cost: parseFloat(output_snc_str[2])
                        }
                    }

                    console.log(msg);
                    res.send(msg);
                }
            })
            .catch(reason => {
                msg = "Something went wrong. Please try again or contact the administrator.";
                console.log(msg);
                res.send(msg);
            });
    } else if (estimation_type == 'eue') {
        input_sim = `${cd_folder} ./sim ${pv_price_per_kw} ${battery_price_per_kwh} 1 ${epsilon_target} ${confidence_level} ${days_in_sample} load.txt pv.txt;`
        promise_sim = exec(input_sim);

        input_snc = `${cd_folder} ./snc_eue ${pv_price_per_kw} ${battery_price_per_kwh} ${epsilon_target} ${confidence_level} ${days_in_sample} load.txt pv.txt;`
        promise_snc = exec(input_snc);

        Promise
            .all([promise_sim, promise_snc])
            .then(results => {
                output_sim = results[0];
                output_snc = results[1];

                if (output_sim.stderr | output_snc.stderr) {
                    msg = "Something went wrong. Please try again or contact the administrator.";
                    console.log(msg);
                    res.send(msg);
                } else {
                    output_sim_str = output_sim.stdout.split("\t");
                    output_snc_str = output_snc.stdout.split("\t");

                    msg = {
                        type: 'eue',
                        sim: {
                            pv_kw: parseFloat(output_sim_str[0]),
                            battery_kwh: parseFloat(output_sim_str[1]),
                            total_cost: parseFloat(output_sim_str[2])
                        },
                        snc: {
                            pv_kw: parseFloat(output_snc_str[0]),
                            battery_kwh: parseFloat(output_snc_str[1]),
                            total_cost: parseFloat(output_snc_str[2])
                        }
                    }

                    console.log(msg);
                    res.send(msg);
                }
            })
            .catch(reason => {
                msg = "Something went wrong. Please try again or contact the administrator.";
                console.log(msg);
                res.send(msg);
            });
    } else {
        msg = 'bad parameter';
        console.log(msg);
        res.send(msg);
    }
});

app.listen(8000, () => {
    console.log('App listening on port 8000!')
});
