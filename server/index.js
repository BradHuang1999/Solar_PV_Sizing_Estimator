const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const cp = require('child_process');

const app = express();

const cmd = "python3"
const args = ["../worker/worker.py"]

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

function spawn_command(input_data) {
    function ab2str(buf) {
        return String.fromCharCode.apply(null, new Uint16Array(buf));
    }

    return new Promise((resolve, reject) => {
        let child = cp.spawn(cmd, args);

        child.stdin.write(input_data);
        child.stdin.end();
    
        child.stdout.on('data', function (data_buffer) {
            str = ab2str(data_buffer)
            resolve(str);
        });
    
        child.stderr.on('data', function (data_buffer) {
            str = ab2str(data_buffer)
            reject(str);
        });
    });
}

app.post('/', async (req, res) => {
    try {
        ret = await spawn_command(JSON.stringify(req.body));
        res.send(JSON.parse(ret));
    } catch (err) {
        console.error("The following error is logged at", Date().toString());
        console.error("Request body:", req.body);
        console.error("Error message:", err);
        res.send({success: 0, error: err})
    }
});

app.listen(8000, () => {
    console.log('App listening on port 8000!')
});
