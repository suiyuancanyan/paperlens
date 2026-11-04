import fs from 'node:fs/promises';
import path from 'node:path';
const [,,source,output]=process.argv;
const waiting=new Set([1,2,3,4,5,6]);
for(const id of waiting)process.stdout.write(JSON.stringify({type:'translate',id,text:`Paragraph ${id}: result {v1}.`})+'\n');
let input='';
for await(const chunk of process.stdin){
  input+=chunk;let newline;
  while((newline=input.indexOf('\n'))>=0){
    const result=JSON.parse(input.slice(0,newline));input=input.slice(newline+1);
    if(!waiting.has(result.id)||!result.text.includes(`段落 ${result.id}`)||!result.text.includes('{v1}'))process.exit(2);
    waiting.delete(result.id);
  }
  if(!waiting.size){
    for(const name of ['translated.pdf','bilingual.pdf'])await fs.copyFile(source,path.join(output,name));
    process.stdout.write(JSON.stringify({type:'complete',pages:1})+'\n');process.exit(0);
  }
}
