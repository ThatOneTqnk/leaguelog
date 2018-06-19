const Discord = require('discord.js');
const client = new Discord.Client();
const request = require('request');
const config = require('./config.json');

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

let leaguetrack = true;

client.on('message', async (msg) => {
  if(!msg.content.startsWith('!')) return;
  let actualmsg = msg.content.split('!')[1]
  let fullmsg = actualmsg.split(' ');
  actualmsg = fullmsg[0]
  switch(actualmsg) {
    case "ping": 
        msg.reply('Pong!');
        break;
    case "league":
        switch(fullmsg[1]) {
            case "enable":
                if(leaguetrack) {
                    msg.channel.send("League tracking already enabled.")
                } else {
                    leaguetrack = true;
                    msg.channel.send("League tracking has been enabled.")
                }
                break;
            case "disable":
                if(!leaguetrack) {
                    msg.channel.send("League tracking already disabled.")
                } else {
                    leaguetrack = false;
                    msg.channel.send("League tracking has been disabled.")
                }
                break;
            case "info":
                var allchamps = []
                if(!fullmsg[2]) {
                    msg.channel.send('**Usage:** !league info (summonerName)');
                } else {
                    msg.channel.send('Fetching information... Please wait.');
                    console.log('wtf');
                    let champs = await doRequest(`https://na1.api.riotgames.com/lol/static-data/v3/champions?api_key=${config.apikey}`);
                    champs = JSON.parse(champs);
                    champs = champs.data
                    console.log(champs);
                    for (var key in champs) {
                        if (champs.hasOwnProperty(key)) {
                            // console.log(key + " -> " + champs[key].id);
                            allchamps.push({champ: key, id: champs[key].id})
                        }
                    }
                    console.log(allchamps);
                    let info1 = await doRequest(`https://na1.api.riotgames.com/lol/summoner/v3/summoners/by-name/${fullmsg[2]}?api_key=${config.apikey}`);
                    info1 = JSON.parse(info1);
                    let info2 = await doRequest(`https://na1.api.riotgames.com/lol/match/v3/matchlists/by-account/${info1.accountId}?api_key=${config.apikey}`);
                    // console.log(info2)
                    info2 = JSON.parse(info2);
                    let matches = info2.matches;
                    matches.forEach((val, index) => {
                        allchamps.forEach((val2) => {
                            if(val.champion === val2.id) {
                                console.log(val2.champ);
                            }
                        })
                    });
                    msg.channel.send('pt2 in logs');
                    msg.channel.send({
                        "content": "Info:",
                        "embed": {
                          "title": `Statistics for ${info1.name}`,
                          "color": 2370121,
                          "author": {
                            "name": "LoLLogs",
                            "url": "https://discordapp.com",
                            "icon_url": "https://cdn.discordapp.com/embed/avatars/0.png"
                          },
                          "fields": [
                            {
                              "name": "Summoner Level",
                              "value": `Level ${info1.summonerLevel}`
                            },
                            {
                              "name": "Death",
                              "value": "death"
                            }
                          ]
                        }
                    });
                    console.log(info1);

                    break;
                }
                break;
            default:
                msg.channel.send("**Usage:** !league (enable|disable)")
        }
   }
});

function doRequest(url) {
    return new Promise(function (resolve, reject) {
      request(url, function (error, res, body) {
        console.log(res.statusCode);
        if (!error && res.statusCode == 200) {
          resolve(body);
        } else {
          reject('bad');
        }
        });
    });
}

function filterIt(arr, searchKey) {
    return arr.filter(function(obj) {
      return Object.keys(obj).some(function(key) {
        return obj[key].includes(searchKey);
      })
    });
}

client.login(`${config.tokenbot}`)