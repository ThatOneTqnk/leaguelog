const request = require('request');
var events = require('events'),
    util = require('util');
const User = require('./tracked.js');

let config;
try {
    config = require('./config.json');
} catch(e) {
    console.log('config.json is hidden. Shell alternatives will be accessed.');
}
let apipass = config.apikey || process.env.apikey;

module.exports = class League {
    constructor() {
        this.dispTrack = [];
        this.tracked = [];
        this.err = [
            {text: 'API Token may be expired. Contact developer if issue persists.', err: 0},
            {text: 'User could not be found.', err: 1}
        ]
        this.matcherr = [
            {text: 'API Token may be expired. Contact developer if issue persists.', err: 0},
            {text: 'User has no valid match history. Recent champion could not be determined.', err: 1}
        ]
        this.cache = [];
        this.track = false;
        this.defaultCache();
        // this.registerEvents();
    }

    registerEvents() {
        let trackRecord = new events();
        trackRecord.on('win')
        trackRecord.emit()
        setInterval(() => {

        }, 500)
    }

    trackAdd(user) {
        return new Promise(async (resolve, reject) => {
            if(user.replace(/[^a-zA-Z0-9-_]/gi) !== user) {
                reject('Invalid input.');
                return;
            }
            let checkUser, winUser;
            try {
                checkUser = await this.verifyUser(user);
                this.tracked.push(checkUser.name);
            } catch (e) {
                reject(e.text);
                return;
            }
            try {
                winUser = await this.latestWin(checkUser.name, checkUser.accountId);
            } catch(e) {
                winUser = {gameId: -1};
            }
            this.dispTrack[(this.dispTrack.length)] = checkUser.name;
            this.tracked[(this.tracked.length)] = new User(checkUser.name, winUser);
            console.log(this.tracked);
            resolve(this.tracked);
        });
    }

    latestWin(user, forceVerify = undefined) {
        return new Promise(async (resolve, reject) => {
            let checkUser = forceVerify;
            if(!forceVerify) console.log('Verification must be done for latestWin.')
            try {
                if(!forceVerify) checkUser = await this.verifyUser(user);
            } catch(e) {
                reject(e.text);
                return;
            }
            if(checkUser.accountId) checkUser = checkUser.accountId;
            let latWin;
            try {
                latWin = await doRequest(`https://na1.api.riotgames.com/lol/match/v3/matchlists/by-account/${checkUser}?api_key=${apipass}`);
                latWin = JSON.parse(latWin);
                resolve(latWin.matches[0]);
            } catch(e) {
                console.log(e);
                console.log('Error in receiving match history.');
                reject(this.matcherr[e.errtype].text);
                return;
            }
            return;
        });
    }




    verifyUser(user) {
        return new Promise(async (resolve, reject) => {
            try {
                let verified = await doRequest(`https://na1.api.riotgames.com/lol/summoner/v3/summoners/by-name/${user}?api_key=${apipass}`);
                verified = JSON.parse(verified);
                resolve(verified);
            } catch(e) {
                reject(this.err[e.errtype]);
            };
        });
    }

    getRecord(user, forceVerify = undefined) {
        return new Promise(async (resolve, reject) => {
            let checkUser, winCount;
            if(!forceVerify) {
                try {
                    checkUser = await this.verifyUser(user);
                } catch(e) {
                    reject(e.text);
                    return;
                }
            } else {
                checkUser = {accountId: forceVerify.accountId};
            }
            try {
                winCount = await doRequest(`https://na1.api.riotgames.com/lol/match/v3/matchlists/by-account/${checkUser.accountId}?api_key=${apipass}&beginIndex=20000000`);
                winCount = JSON.parse(winCount);
            } catch(e) {
                console.log(e);
                reject(this.matcherr[e.errtype].text);
                return;
            }
            if(winCount.status && winCount.status.status_code === 404) {
                reject('User has no match history.');
                return;
            }
            console.log(winCount);
            resolve(winCount.totalGames);
        });
    }

    userInfo(user) {
        return new Promise(async (resolve, reject) => {
            let info1, info2, info3;
            try {
                info1 = await doRequest(`https://na1.api.riotgames.com/lol/summoner/v3/summoners/by-name/${user}?api_key=${apipass}`);
            } catch(e) {
                reject(this.err[e.errtype]);
            }
            info1 = JSON.parse(info1);
            try {
                info2 = await doRequest(`https://na1.api.riotgames.com/lol/match/v3/matchlists/by-account/${info1.accountId}?api_key=${apipass}`);
                info3 = await doRequest(`https://na1.api.riotgames.com/lol/match/v3/matchlists/by-account/${info1.accountId}?api_key=${apipass}&beginIndex=20000000`);
            } catch(e) {
                reject(this.matcherr[e.errtype]);
            }
            info3 = JSON.parse(info3);
            info2 = JSON.parse(info2);
            info2 = info2.matches;
            var champIds = [];
            info2.forEach((val) => {
                champIds.push(val.champion);
            });
            var mode = moded(champIds);
            var mostchamp = this.cache.findIndex((element) => {
                return element.id === mode;
            });
            // console.log(this.cache[mostchamp].champ);
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
        this.cache = (config.defaultcache || process.env.defaultcache)
    }

    // getId(user) {
    //     let forceVerify;
    //     try {
    //         forceVerify = await this.verifyUser(user);
    //     } catch(e) {
    //         return {err: true, msg: e.text};
    //     }
    //     return {err: false, accountId: forceVerify.accountId};
    // }

    refreshCache() {
        return new Promise(async (resolve, reject) => {
            try {
                this.cache = [];
                let champs = await doRequest(`https://na1.api.riotgames.com/lol/static-data/v3/champions?api_key=${apipass}`);
                champs = JSON.parse(champs);
                champs = champs.data;
                for (var key in champs) {
                    if (champs.hasOwnProperty(key)) {
                        this.cache.push({champ: key, id: champs[key].id})
                    }
                }
                resolve(this.cache);
            } catch(e) {
                reject(this.err[e.errtype]);
            }
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

function moded(array) {
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
