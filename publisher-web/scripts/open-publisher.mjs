#!/usr/bin/env node
import {doctor} from './open-publisher-doctor.mjs';
import {actions} from './open-publisher-client.mjs';
const command=process.argv[2];
if(command==='--help'||!command){console.log('Open Publisher\nCommands: '+['doctor',...Object.keys(actions)].join(', ')+'\nInput: JSON on stdin; get/update/review require id. Updates and reviews require revision.\nConfigure OPEN_PUBLISHER_URL and OPEN_PUBLISHER_TOKEN; private Sites also require OPEN_PUBLISHER_SITES_TOKEN.\nOutput: JSON. No automatic write retries.');process.exit(0);}
try {
 if(command==='doctor'){const report=await doctor();console.log(JSON.stringify(report,null,2));process.exit(report.ok?0:1);}
 if(!Object.hasOwn(actions,command))throw new Error('Unknown command. Run --help.');
 let raw='';if(!['session','connections','channels','list'].includes(command)){for await(const chunk of process.stdin){raw+=chunk;if(raw.length>1000000)throw new Error('Input too large.');}}
 const input=raw.trim()?JSON.parse(raw):{};
 if(['get','update','review','compareNotion','pullNotion','pushNotion','reconcileNotion','typefullyStatus','createTypefullyDraft'].includes(command)&&typeof input.id!=='string')throw new Error('id is required.');
 console.log(JSON.stringify(await actions[command](input),null,2));
}catch(error){console.error(JSON.stringify({error:error.message}));process.exitCode=1;}
