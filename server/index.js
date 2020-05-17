const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const cp = require('child_process');
const axios = require('axios');
const requestIp = require('request-ip');

const app = express();

const worker_cmd = process.env.CMD_MISTRAL_WORKER;

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.post('/', async (req, res) => {
    try {
        let cp_result = cp.execSync(worker_cmd, {
            input: JSON.stringify(req.body),
            encoding: 'utf8'
        });
        res.send(cp_result);
    } catch (err) {
        console.error("The following error is logged at", Date().toString());
        console.error("Request body:", req.body);
        console.error("Error message:", err);
        res.status(500).send({success: 0, error: err});
    }
});

app.get('/getLocationFromAddress', async (req, res) => {
    address = req.query.address;

    if (!address) {
        ret = {
            success: 0,
            errors: {
                ip: "no valid address"
            }
        };

        res.status(404).send(ret);
        return;
    }

    try {
        mapQuestRes = await axios.get(`http://www.mapquestapi.com/geocoding/v1/address`, {
            params: {
                key: process.env.MAPQUEST_KEY,
                location: address
            }
        });

        if (!mapQuestRes) {
            throw "mapquest did not return";
        } else if (!mapQuestRes.data) {
            throw "mapquest returned no data";
        } else if (!mapQuestRes.data.results) {
            throw "mapquest returned no results"
        } else if (!mapQuestRes.data.results.length) {
            throw "mapquest returned empty results"
        }

        results = mapQuestRes.data.results[0];

        if (!results) {
            throw "mapquest returned invalid results"
        } else if (!results.locations) {
            throw "mapquest returned no locations"
        } else if (!results.locations.length) {
            throw "mapquest returned empty locations"
        }

        locs = results.locations;

        ret = {
            success: 1,
            data: locs
        }

        res.send(ret);
    } catch (err) {
        ret = {
            success: 0,
            errors: {
                mapquest: err
            }
        };

        res.status(404).send(ret);
    }
});

app.get('/getLocationFromIP', requestIp.mw(), async (req, res) => {
    ip = req.query.ip || req.clientIp;

    if (!ip) {
        ret = {
            success: 0,
            errors: {
                ip: "no valid ip"
            }
        };

        res.status(404).send(ret);
        return;
    }

    try {
        ipstackRes = await axios.get(`http://api.ipstack.com/${ip}`, {
            params: {
                access_key: process.env.IPSTACK_KEY,
                format: 1
            }
        });

        if (!ipstackRes) {
            throw "ipstack did not return";
        } else if (!ipstackRes.data) {
            throw "ipstack returned no data";
        }

        loc = ipstackRes.data;

        ret = {
            success: 1,
            source: 'ipstack',
            data: {
                city: loc.city,
                region: loc.region_code ? loc.region_code : loc.region_name,
                country: loc.country_name,
                lat: loc.latitude,
                lon: loc.longitude
            }
        };

        if (!ret.data.lat || !ret.data.lon || !ret.data.country) {
            throw "ipstack returned invalid data";
        }

        res.send(ret);
    } catch (ipstackErr) {
        try {
            iplocateRes = await axios.get(`https://www.iplocate.io/api/lookup/${ip}`);

            if (!iplocateRes) {
                throw "iplocate did not return";
            } else if (!iplocateRes.data) {
                throw "iplocate returned no data";
            }

            loc = iplocateRes.data;

            ret = {
                success: 1,
                source: 'iplocate',
                data: {
                    city: loc.city,
                    region: loc.subdivision,
                    country: loc.country,
                    lat: loc.latitude,
                    lon: loc.longitude
                }
            };

            if (!ret.data.lat || !ret.data.lon || !ret.data.country) {
                throw "iplocate returned invalid data";
            }

            res.send(ret);
        } catch (iplocateErr) {
            ret = {
                success: 0,
                errors: {
                    ipstack: ipstackErr,
                    iplocate: iplocateErr
                }
            }

            res.status(404).send(ret);
        }
    }
});

app.listen(8000, () => {
    console.log("Server Starting at port 8000");
});
