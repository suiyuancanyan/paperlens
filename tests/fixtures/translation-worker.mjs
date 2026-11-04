import fs from 'node:fs/promises';
import path from 'node:path';
const [, , source, output] = process.argv;
process.stdout.write(JSON.stringify({type:'translate',id:1,text:'The result is {v1}.'})+'\n');
let input='';
for await(const chunk of process.stdin){
  input+=chunk;
  if(input.includes('\n')){
    const response=JSON.parse(input.trim());
    if(!response.text.includes('{v1}'))process.exit(2);
    for(const name of ['translated.pdf','bilingual.pdf'])await fs.copyFile(source,path.join(output,name));
    process.stdout.write(JSON.stringify({type:'complete',pages:1})+'\n');
    process.exit(0);
  }
}
