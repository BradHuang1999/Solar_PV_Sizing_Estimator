const express = require('express')
const app = express();

// const bodyParser = require('body-parser');
// app.use(bodyParser.json()); // support json encoded bodies
// app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

const util = require('util');
const exec = util.promisify(require('child_process').exec);

const cd_folder = 'cd estimation_compiled; ';

app.get('/', async (req, res) => {
    const est_type = req.query['estimation_type'];

    if (est_type === 'lolp') {
        input_sim = cd_folder + './sim 2000 500 0 0.01 0.95 100 load.txt pv.txt;'
        promise_sim = exec(input_sim);

        input_snc = cd_folder + './snc_lolp 2000 500 0.01 0.95 100 load.txt pv.txt;'
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
                    output_sim_str = output_sim.stdout.split("\t").join("\n");
                    output_snc_str = output_snc.stdout.split("\t").join("\n");

                    msg =
                        "LOLP Results:" + "\n\n" +
                        "Sim:\n" + output_sim_str + "\n" +
                        "SNC:\n" + output_snc_str + "\n";

                    console.log(msg);
                    res.send(msg);
                }
            })
            .catch(reason => {
                msg = "Something went wrong. Please try again or contact the administrator.";
                console.log(msg);
                res.send(msg);
            });
    } else if (est_type == 'eue') {
        input_sim = cd_folder + './sim 2000 500 1 0.05 0.95 100 load.txt pv.txt;'
        promise_sim = exec(input_sim);

        input_snc = cd_folder + './snc_eue 2000 500 0.05 0.95 100 load.txt pv.txt;'
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
                    output_sim_str = output_sim.stdout.split("\t").join("\n");
                    output_snc_str = output_snc.stdout.split("\t").join("\n");

                    msg =
                        "EUE Results:" + "\n\n" +
                        "Sim:\n" + output_sim_str + "\n" +
                        "SNC:\n" + output_snc_str + "\n";

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
