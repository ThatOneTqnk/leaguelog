const request = require('request');
const config = require('./config.json');

module.exports = class League {
    constructor() {
        this.err = [
            'API Token may be expired. Contact developer if issue persists.',
            'User could not be found.'
        ]
        this.matcherr = [
            'User has no valid match history. Recent champion could not be determined.',
            'User has no valid match history. Recent champion could not be determined.'
        ]
        this.cache = [];
        this.track = true;
        this.defaultCache();
    }

    userInfo(user) {
        return new Promise(async (resolve, reject) => {
            let info1 = await doRequest(`https://na1.api.riotgames.com/lol/summoner/v3/summoners/by-name/${user}?api_key=${config.apikey}`).catch(e => {
                reject(this.err[e.errtype]);
            });
            info1 = JSON.parse(info1);
            let info2 = await doRequest(`https://na1.api.riotgames.com/lol/match/v3/matchlists/by-account/${info1.accountId}?api_key=${config.apikey}`).catch(e => {
                reject(this.matcherr[e.errtype]);
            });
            let info3 = await doRequest(`https://na1.api.riotgames.com/lol/match/v3/matchlists/by-account/${info1.accountId}?api_key=${config.apikey}&beginIndex=20000000`).catch(e => {
                reject(this.matcherr[e.errtype]);
            });
            info3 = JSON.parse(info3);
            info2 = JSON.parse(info2);
            info2 = info2.matches;
            var champIds = [];
            info2.forEach((val) => {
                champIds.push(val.champion);
            });
            var mode = modez(champIds);
            var mostchamp = this.cache.findIndex((element) => {
                return element.id === mode;
            });
            console.log(this.cache[mostchamp].champ);
            resolve({
                id: info1.id,
                accountId: info1.accountId,
                name: info1.name,
                level: info1.summonerLevel,
                recentChamp: this.cache[mostchamp].champ,
                totalMatches: info3.totalGames
            });
        });
    }
    defaultCache() {
        this.cache = config.defaultcache
    }

    refreshCache() {
        return new Promise(async (resolve, reject) => {
            this.cache = [];
            let champs = await doRequest(`https://na1.api.riotgames.com/lol/static-data/v3/champions?api_key=${config.apikey}`).catch((err) => {
                reject(this.err[e.errtype]);
            })
            champs = JSON.parse(champs);
            champs = champs.data;

            for (var key in champs) {
                if (champs.hasOwnProperty(key)) {
                    this.cache.push({champ: key, id: champs[key].id})
                }
            }

            resolve(this.cache);
        }); 
    }

}

function doRequest(url) {
    return new Promise(function (resolve, reject) {
        request(url, function (error, res, body) {
            if(res.statusCode === 404) {
                reject({errtype: 1});
            }
            if (!error && res.statusCode === 200) {
                resolve(body);
            } else {
                reject({errtype: 0});
            }
        });
    });
}

function modez(array) {
    if(array.length == 0)
        return null;
    var modeMap = {};
    var maxEl = array[0], maxCount = 1;
    for(var i = 0; i < array.length; i++) {
        var el = array[i];
        if(modeMap[el] == null)
            modeMap[el] = 1;
        else
            modeMap[el]++;  
        if(modeMap[el] > maxCount)
        {
            maxEl = el;
            maxCount = modeMap[el];
        }
    }
    return maxEl;
}