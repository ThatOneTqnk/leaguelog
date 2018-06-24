const league = require('./league.js');
module.exports = class User {
    constructor(name, accid, matObj) {
        this.accid = accid;
        this.name = name;
        this.latestMatch = matObj; 
    }
}