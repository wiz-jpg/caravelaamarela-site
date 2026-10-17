/* Open only if the team recently verified the official call, and deadline is live. */
(function(root){"use strict";
 const days=(a,b)=>Math.round((Date.parse(a+"T00:00:00Z")-Date.parse(b+"T00:00:00Z"))/86400000);
 const date=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&
   !Number.isNaN(Date.parse(s+"T00:00:00Z"))&&
   new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
 function open(row,today){
  if(!date(today)||row?.availability!=="open_verified"||
     !date(row.open_verified_on)||!date(row.verified_on)||!date(row.deadline))return false;
  if(row.status==="declined"||row.status==="closed"||row.status==="awarded")return false;
  const age=days(today,row.open_verified_on);
  return age>=0&&age<=30&&today<=row.deadline&&
    row.verified_on<=today&&row.open_verified_on<=row.verified_on;
 }
 root.CaravelaOpportunityCheck=Object.freeze({open});
})(typeof globalThis!=="undefined"?globalThis:null);
