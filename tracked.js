const league = require('./league.js');
module.exports = class User {
    constructor(name, accid, winObj) {
        this.accid = accid;
        this.name = name;
        this.latestWin = winObj; 
    }
}