const Discord = require('discord.js');
const client = new Discord.Client();
const request = require('request');
const config = require('./config.json');
const League = require('./league.js');

let leagueInstance = new League();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', async (msg) => {
  if(!msg.content.startsWith('!')) return;
  let actualmsg = msg.content.split('!')[1]
  let fullmsg = actualmsg.split(' ');
  actualmsg = fullmsg[0]
  switch(actualmsg) {
    case "league":
        switch(fullmsg[1]) {
            case "enable":
                if(leagueInstance.track) {
                    msg.channel.send("League tracking already enabled.")
                } else {
                    leagueInstance.track = true;
                    msg.channel.send("League tracking has been enabled.")
                }
                break;
            case "disable":
                if(!leagueInstance.track) {
                    msg.channel.send("League tracking already disabled.")
                } else {
                    leagueInstance.track = false;
                    msg.channel.send("League tracking has been disabled.")
                }
                break;
            case "info":
                if(!fullmsg[2]) {
                    msg.channel.send('**Usage:** !league info (summonerName)');
                } else {
                    msg.channel.send('Fetching information... Please wait.');
                    leagueInstance.defaultCache();
                    let user = await leagueInstance.userInfo(fullmsg[2]).catch(e => {
                        msg.channel.send(e);
                    });
                    if(!user) break;
                    msg.channel.send({
                        "embed": {
                          "color": 4144495,
                          "thumbnail": {
                            "url": "https://i.imgur.com/x17LAwy.png"
                          },
                          "author": {
                            "name": `User: ${user.name}`
                          },
                          "fields": [
                            {
                                "name": "Summoner Level",
                                "value": `${user.level}`
                            },
                            {
                                "name": "Most Recently Used Champion (Last 100 games)",
                                "value": `${user.recentChamp}`
                            },
                            {
                                "name": "Total games played:",
                                "value": `${user.totalMatches}`
                            }
                          ]
                        }
                    });
                    break;
                }
                break;
            default:
                msg.channel.send("**Usage:** !league (enable|disable)")
        }
    case "source":
        msg.channel.send('League API and other stuff can be found here.\n')
    
    default:
        msg.channel.send('Unknown command!');
        
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