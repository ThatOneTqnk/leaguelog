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
            {text: 'User has no valid match history.', err: 1}
        ]
        this.champCache = [];
        this.spellCache = [];
        this.mapCache = [];
        this.itemCache = [];
        this.track = false;
        this.funnel = new events();
        this.defaultCache();
        this.registerEvents();
        
    }

    registerEvents() {
        let loopWin, matchInfo;
        setInterval(() => {
            if(this.tracked.length === 0) return;
            this.tracked.forEach(async (val) => {
                try {
                    loopWin = await this.latestMatch(val.name, val.accid);  
                } catch(e) {
                    loopWin = {gameId: -1};
                }
                // Below condition checks if first match in user's match list is incosistent with cache. If so, determine whether it was a win or not.
                if(loopWin.gameId !== val.latestMatch.gameId) {
                    matchInfo = await this.analyzeMatch(loopWin.gameId, val.accid);
                    this.funnel.emit('match', matchInfo);
                };
            });
        }, 3500);
    }

    analyzeMatch(id, userId = -1) {
        return new Promise(async (resolve, reject) => {
            let matchDeets, playerID, playerName;
            try {
                matchDeets = await doRequest(`https://na1.api.riotgames.com/lol/match/v3/matches/${id}?api_key=${apipass}`);
            } catch(e) {
                console.log('fell into err.');
                reject(this.matcherr[e.errtype].text);
                return;
            }
            matchDeets = JSON.parse(matchDeets);
            let filterDeets = {};
            matchDeets.participantIdentities.forEach((val) => {
                if(val.player.accountId === userId) {
                    playerID = val.participantId;
                    playerName = val.player.summonerName;
                }
            });
            let userStats = matchDeets.participants[(playerID - 1)];
            filterDeets.user = playerName;
            filterDeets.userWin = userStats.stats.win;
            filterDeets.champion = this.champLookup(userStats.championId);
            filterDeets.lane = capsFirst(userStats.timeline.lane);
            filterDeets.kills = userStats.stats.kills;
            filterDeets.deaths = userStats.stats.deaths;
            filterDeets.assists = userStats.stats.assists;
            filterDeets.largestSpree = userStats.stats.largestKillingSpree;
            filterDeets.doubleKills = userStats.stats.doubleKills;
            filterDeets.tripleKills = userStats.stats.tripleKills;
            filterDeets.quadraKills = userStats.stats.quadraKills;
            filterDeets.pentaKills = userStats.stats.pentaKills;
            filterDeets.firstBlood = userStats.stats.firstBloodKill;
            filterDeets.spells = [this.spellLookup(userStats.spell1Id), this.spellLookup(userStats.spell2Id)];
            filterDeets.cs = userStats.stats.totalMinionsKilled;
            filterDeets.items = [
                this.itemLookup(userStats.stats.item0),
                this.itemLookup(userStats.stats.item1),
                this.itemLookup(userStats.stats.item2),
                this.itemLookup(userStats.stats.item3),
                this.itemLookup(userStats.stats.item4),
                this.itemLookup(userStats.stats.item5),
            ]
            filterDeets.trinket = this.itemLookup(userStats.stats.item6);
            filterDeets.champLevel = userStats.stats.champLevel;
            filterDeets.matchTime = Math.ceil(matchDeets.gameDuration / 60);
            filterDeets.map = this.mapLookup(matchDeets.mapId);
            // console.log(filterDeets);

            // console.log(matchDeets);
            resolve(filterDeets);
        })
    }

    trackAdd(user) {
        return new Promise(async (resolve, reject) => {
            if(user.replace(/[^a-zA-Z0-9-_]/gi) !== user) {
                reject('Invalid input.');
                return;
            }
            let checkUser, matUser;
            try {
                checkUser = await this.verifyUser(user);
                // this.tracked.push(checkUser.name);
            } catch (e) {
                reject(e.text);
                return;
            }
            try {
                matUser = await this.latestMatch(checkUser.name, checkUser.accountId);
            } catch(e) {
                console.log('handled?');
                matUser = {gameId: -1};
            }
            this.dispTrack[(this.dispTrack.length)] = checkUser.name;
            this.tracked[(this.tracked.length)] = new User(checkUser.name, checkUser.accountId, matUser);
            // console.log(this.tracked);
            resolve(this.tracked);
        });
    }

    latestMatch(user, forceVerify = undefined) {
        return new Promise(async (resolve, reject) => {
            let checkUser = forceVerify;
            if(!forceVerify) console.log('Verification must be done for latestMatch.')
            try {
                if(!forceVerify) checkUser = await this.verifyUser(user);
            } catch(e) {
                reject(e.text);
                return;
            }
            if(checkUser.accountId) checkUser = checkUser.accountId;
            let latMat;
            try {
                latMat = await doRequest(`https://na1.api.riotgames.com/lol/match/v3/matchlists/by-account/${checkUser}?api_key=${apipass}`);
                latMat = JSON.parse(latMat);
                resolve(latMat.matches[0]);
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

    champLookup(id) {
        let result = this.champCache.filter(function(obj) {
            return obj.id == id;
        });
        return result[0].champ;
    }

    spellLookup(id) {
        let result = this.spellCache.filter(function(obj) {
            return obj.id == id;
        });
        return result[0].spell;
    }

    itemLookup(id) {
        let result = this.itemCache.filter(function(obj) {
            return obj.id == id;
        });
        return result[0].item;
    }

    mapLookup(id) {
        let result = this.mapCache.filter(function(obj) {
            return obj.id == id;
        });
        return result[0].map;
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
            var mostchamp = this.champCache.findIndex((element) => {
                return element.id === mode;
            });
            // console.log(this.champCache[mostchamp].champ);
            resolve({
                id: info1.id,
                accountId: info1.accountId,
                name: info1.name,
                level: info1.summonerLevel,
                recentChamp: this.champCache[mostchamp].champ,
                totalMatches: info3.totalGames
            });
        });
    }
    defaultCache() {
        this.champCache = (config.champCache || process.env.defaultcache);
        this.spellCache = (config.spellCache || process.env.spellCache);
        this.itemCache = (config.itemCache || process.env.itemCache);
        this.mapCache = (config.mapCache || process.env.mapCache);
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
                this.champCache = [];
                let champs = await doRequest(`https://na1.api.riotgames.com/lol/static-data/v3/champions?api_key=${apipass}`);
                champs = JSON.parse(champs);
                champs = champs.data;
                for (var key in champs) {
                    if (champs.hasOwnProperty(key)) {
                        this.champCache.push({champ: key, id: champs[key].id});
                    }
                }
            } catch(e) {
                reject(this.err[e.errtype]);
            }
            try {
                this.spellCache = [];
                let spells = await doRequest(`https://na1.api.riotgames.com/lol/static-data/v3/summoner-spells?api_key=${apipass}`);
                spells = JSON.parse(spells);
                spells = spells.data;
                for(var key in spells) {
                    if(spells.hasOwnProperty(key)) {
                        this.spellCache.push({spell: spells[key].name, id: spells[key].id});
                    }
                }
            } catch(e) {
                reject(this.err[e.errtype]);
            }
            try {
                this.itemCache = [];
                let items = await doRequest(`https://na1.api.riotgames.com/lol/static-data/v3/items?api_key=${apipass}`);
                items = JSON.parse(items);
                items = items.data;
                for(var key in items) {
                    if(items.hasOwnProperty(key)) {
                        this.itemCache.push({item: items[key].name, id: items[key].id});
                    }
                }
            } catch(e) {
                reject(this.err[e.errtype]);
            } 
            try {
                this.mapCache = [];
                let maps = await doRequest(`https://na1.api.riotgames.com/lol/static-data/v3/maps?api_key=${apipass}`);
                maps = JSON.parse(maps);
                maps = maps.data;
                for(var key in maps) {
                    if(maps.hasOwnProperty(key)) {
                        this.mapCache.push({map: maps[key].mapName, id: maps[key].mapId});
                    }
                }
            } catch(e) {
                reject(this.err[e.errtype])
            }
            resolve('Refreshed all statics.');
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

function capsFirst(string) {
    string = string.toLowerCase();
    return string.charAt(0).toUpperCase() + string.slice(1);
}