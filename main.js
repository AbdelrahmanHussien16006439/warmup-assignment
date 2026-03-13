const fs = require("fs");
// helper functions:
function time12toSeconds(t) {
    const str = t.toLowerCase().trim();
    const pm = str.includes("pm");
    const am = str.includes("am");

    let [h,m,s] = str.replace("am","").replace("pm","").trim().split(":").map(Number);

    if(pm && h !== 12) h += 12;
    if(am && h === 12) h = 0;

    return h*3600 + m*60 + s;
}

function secondsToHms(sec){
    const h = Math.floor(sec/3600);
    sec%=3600;
    const m = Math.floor(sec/60);
    const s = sec%60;
    return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function hmsToSeconds(hms){
    const [h,m,s] = hms.split(":").map(Number);
    return h*3600 + m*60 + s;
}

function readLines(file){
    return fs.readFileSync(file,"utf8").trim().split("\n").slice(1);
}

function writeLines(file,lines){
    const header="DriverID,DriverName,Date,StartTime,EndTime,ShiftDuration,IdleTime,ActiveTime,MetQuota,HasBonus";
    fs.writeFileSync(file,header+"\n"+lines.join("\n"));
}

function parseShift(line){
    const p=line.split(",");
    return{
        driverID:p[0],
        driverName:p[1],
        date:p[2],
        startTime:p[3],
        endTime:p[4],
        shiftDuration:p[5],
        idleTime:p[6],
        activeTime:p[7],
        metQuota:p[8]==="true",
        hasBonus:p[9]==="true"
    }
}

function shiftToLine(o){
    return [
        o.driverID,
        o.driverName,
        o.date,
        o.startTime,
        o.endTime,
        o.shiftDuration,
        o.idleTime,
        o.activeTime,
        o.metQuota,
        o.hasBonus
    ].join(",");
}

function readRates(file){
    const map={};
    const lines=fs.readFileSync(file,"utf8").trim().split("\n");
    for(const l of lines){
        const p=l.split(",");
        map[p[0]]={
            dayOff:p[1],
            baseSalary:Number(p[2]),
            tier:Number(p[3])
        }
    }
    return map;
}
// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
   let s=time12toSeconds(startTime);
    let e=time12toSeconds(endTime);

    if(e<s) e+=86400;

    return secondsToHms(e-s);
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
   
   let s=time12toSeconds(startTime);
    let e=time12toSeconds(endTime);

    if(e<s) e+=86400;

    const WORK_START=8*3600;
    const WORK_END=22*3600;

    let idle=0;

    if(s<WORK_START)
        idle+=Math.min(e,WORK_START)-s;

    if(e>WORK_END)
        idle+=e-Math.max(s,WORK_END);

    return secondsToHms(idle);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    
    const d=hmsToSeconds(shiftDuration);
    const i=hmsToSeconds(idleTime);

    return secondsToHms(d-i);
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
     const active=hmsToSeconds(activeTime);

    const eid = date>="2025-04-10" && date<="2025-04-30";

    const quota = eid ? 6*3600 : (8*3600 + 24*60);

    return active>=quota;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    
   const lines=readLines(textFile);
    const rec=lines.map(parseShift);

    if(rec.find(r=>r.driverID===shiftObj.driverID && r.date===shiftObj.date))
        return {};

    const shiftDuration=getShiftDuration(shiftObj.startTime,shiftObj.endTime);
    const idleTime=getIdleTime(shiftObj.startTime,shiftObj.endTime);
    const activeTime=getActiveTime(shiftDuration,idleTime);
    const quota=metQuota(shiftObj.date,activeTime);

    const newRec={
        driverID:shiftObj.driverID,
        driverName:shiftObj.driverName,
        date:shiftObj.date,
        startTime:shiftObj.startTime,
        endTime:shiftObj.endTime,
        shiftDuration,
        idleTime,
        activeTime,
        metQuota:quota,
        hasBonus:false
    };

    rec.push(newRec);

    rec.sort((a,b)=>{
        if(a.driverID!==b.driverID)
            return a.driverID.localeCompare(b.driverID);
        return a.date.localeCompare(b.date);
    });

    writeLines(textFile,rec.map(shiftToLine));

    return newRec;
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
   
     const rec=readLines(textFile).map(parseShift);

    for(const r of rec){
        if(r.driverID===driverID && r.date===date){
            r.hasBonus=newValue;
        }
    }

    writeLines(textFile,rec.map(shiftToLine));

}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
     

    month=String(month).padStart(2,"0");

    const rec=readLines(textFile).map(parseShift);

    if(!rec.some(r=>r.driverID===driverID))
        return -1;

    let c=0;

    for(const r of rec){
        if(r.driverID===driverID && r.date.split("-")[1]===month && r.hasBonus)
            c++;
    }

    return c;
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    month=String(month).padStart(2,"0");

    const rec=readLines(textFile).map(parseShift);

    let total=0;

    for(const r of rec){
        if(r.driverID===driverID && r.date.split("-")[1]===month)
            total+=hmsToSeconds(r.activeTime);
    }

    return secondsToHms(total);
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
   month=String(month).padStart(2,"0");

    const rec=readLines(textFile).map(parseShift);

    let req=0;

    for(const r of rec){

        if(r.driverID===driverID && r.date.split("-")[1]===month){

            const eid=r.date>="2025-04-10" && r.date<="2025-04-30";

            req+= eid ? 6*3600 : (8*3600 + 24*60);

        }
    }

    req -= bonusCount*2*3600;

    if(req<0) req=0;

    return secondsToHms(req);
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
     const rates=readRates(rateFile);
    const info=rates[driverID];

    if(!info) return 0;

    const baseSalary=info.baseSalary;
    const tier=info.tier;

    const actualSec=hmsToSeconds(actualHours);
    const requiredSec=hmsToSeconds(requiredHours);

    if(actualSec>=requiredSec) return baseSalary;

    const missingSec=requiredSec-actualSec;

    const allowedSec=tier*9*3600;

    if(missingSec<=allowedSec) return baseSalary;

    const extraSec=missingSec-allowedSec;

    const extraHours=Math.floor(extraSec/3600);

    const deduction=extraHours*54;

    const net=baseSalary-deduction;

    return net<0?0:net;
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
