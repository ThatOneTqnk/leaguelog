const Discord = require('discord.js');
const client = new Discord.Client();
const request = require('request');
let config;
try {
    config = require('./config.json');
} catch(e) {
    console.log('config.json is hidden. Shell alternatives will be accessed.')
}
const League = require('./league.js');

let leagueInstance = new League();


module.exports = class LeagueBot {
    constructor() {
        this.registerEvents();
        this.leagueChannel = false;
        client.login(`${config.tokenbot || process.env.tokenbot}`);
    }

    registerEvents() {
        client.on('ready', () => {
            client.channels.find('name', 'league-log');
            console.log(`Logged in as ${client.user.tag}!`);
        });
        
        
          
        leagueInstance.funnel.on('match', (details) => {
            // console.log(`${details.user} has played a match!`);
            // console.log(`Details: ${details}`);
            console.log('detected win');
            let winStatus = details.userWin ? 'won' : 'lost';
            this.leagueChannel.send({
                "embed": {
                  "thumbnail": {
                    "url": `https://i.imgur.com/x17LAwy.png`
                  },
                  "fields": [
                    {
                        "name": `New Match`,
                        "value": `${details.user} has ${winStatus} a game.`
                    },
                    {
                      "name": `Champion`,
                      "value": `${details.champion}`
                    },
                    {
                        "name": "Lane",
                        "value": `${details.lane}`
                    },
                    {
                        "name": "KDA",
                        "value": `${details.kills} | ${details.deaths} | ${details.assists}`
                    },
                    {
                        "name": "Largest Killing Spree",
                        "value": `${details.largestSpree}`
                    }
                  ]
                }});
        });
        
        
    client.on('message', async (msg) => {
        if(msg.author.bot) return;
        if(!msg.content.startsWith('!')) return;
        let actualmsg = msg.content.split('!')[1]
        let fullmsg = actualmsg.split(' ');
        actualmsg = fullmsg[0]
          switch(actualmsg) {
            case "league":
                switch(fullmsg[1]) {
                    case "status":
                        let resString = (leagueInstance.track) ? "enabled":"disabled";
                        msg.channel.send(`League tracking is ${resString}.`);
                        break;
                    case "configure":
                        if(!fullmsg[2]) {
                            msg.channel.send('!league configure <channelname>');
                            break;
                        }
                        let channelLog = client.channels.find('name', fullmsg[2].toLowerCase());
                        if(!channelLog) {
                            msg.channel.send('Invalid text channel.');
                            break;
                        }
                        msg.channel.send(`Successfully set league log channel to #${channelLog.name}.`)
                        this.leagueChannel = channelLog;
                        break;
                    case "enable":
                        if(!this.leagueChannel) {
                            msg.channel.send('You must configure a channel for the League logger to log out in.\n\nThis can be done with `!league configure <channel-name>`');
                            break;
                        }
                        if(leagueInstance.track) {
                            msg.channel.send("League tracking already enabled.")
                        } else {
                            if(leagueInstance.tracked.length === 0) {
                                msg.channel.send("Cannot track empty tracklist.\n\nPlease add users by using\n\n`!league track (user)`.");
                                break;
                            }
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
                    case "clear":
                    case "empty":
                        leagueInstance.tracked = [];
                        leagueInstance.dispTrack = [];
                        msg.channel.send('Cleared player trackers.');
                        break;
                    case "list":
                        if(leagueInstance.dispTrack.length === 0) {
                            msg.channel.send('No players are being tracked.');
                            break;
                        }
                        msg.channel.send(`List of tracked players:\n${leagueInstance.dispTrack.join(', ')}`);
                        break;
                    case "track":
                        if(!fullmsg[2]) {
                            msg.channel.send('**Usage:** !league track (summonerName)');
                            break;
                        }
                        if(leagueInstance.tracked.length >= 10) {
                            msg.channel.send('League bot can only track 10 users at maximum.');
                            break;
                        }
                        msg.channel.send('Adding player to track list...');
                        let trackPlayer;
                        try {
                            trackPlayer = await leagueInstance.trackAdd(fullmsg[2]);
                        } catch(e) {
                            msg.channel.send(e);
                            break;
                        }
                        msg.channel.send(`Successfully added ${fullmsg[2]} to track list.`);
                        break;
                    case "stats":
                    case "info":
                        if(!fullmsg[2]) {
                            msg.channel.send('**Usage:** !league info (summonerName)');
                            break;
                        } else {
                            msg.channel.send('Fetching information... Please wait.');
                            leagueInstance.defaultCache();
                            let user = await leagueInstance.userInfo(fullmsg[2]).catch(e => {
                                msg.channel.send(e.text);
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
                        msg.channel.send("**Usage:** !league (enable|disable)");
                }
                break;
            case "source":
                msg.channel.send('League API and other stuff can be found here.\nhttps://github.com/ThatOneTqnk/leaguelog');
                break;
            
            default:
                msg.channel.send('Unknown command!');
                
           }
        });
    }

}

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