import assert from "node:assert/strict";
import test from "node:test";
import {mkdtemp,mkdir,writeFile,readFile,cp,chmod,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {enumerateSeoFiles} from "../lib/seo-asset-contract.mjs";

const builder=fileURLToPath(new URL("../build-seo-pages.mjs",import.meta.url));
const book=(id,slug,language_code,parent_book_id=null)=>({
 id,slug,language_code,parent_book_id,title:"Story "+slug,author_name:"A Writer",
 description:"A published story "+slug,cover_url:"https://img.example/"+slug+".jpg",
 category:"Thriller",tags:["completed"],total_chapters:2,
 is_featured:language_code==="en",status:"published",
 published_at:"2026-09-20T00:00:00Z",created_at:"2026-09-20T00:00:00Z",
 updated_at:"2026-09-20T00:00:00Z"
});
function chapter(book_id,number,content){
 return {id:book_id+"-"+number,book_id,chapter_number:number,
  title:"Part "+number,content,word_count:content.split(/\s+/).length,
  status:"published",published_at:"2026-09-20T00:00:00Z"};
}
async function makeFixture(t){
 const base=await mkdtemp(join(tmpdir(),"soma-seo-diff-"));t.after(()=>rm(base,{recursive:true,force:true}));
 const bin=join(base,"bin");await mkdir(bin);
 const mock=String.raw`#!/usr/bin/env node
import {readFileSync} from "node:fs";
const address=process.argv.find(x=>x.includes("/rest/v1/"));
if(!address)process.exit(2);
const url=new URL(address);
const collection=url.pathname.split("/").at(-1);
const state=JSON.parse(readFileSync(process.env.SOMA_TEST_FIXTURE,"utf8"));
const pageSize=Number(url.searchParams.get("limit")||1000);
const offset=Number(url.searchParams.get("offset")||0);
process.stdout.write(JSON.stringify(state[collection].slice(offset,offset+pageSize)));
`;
 const path=join(bin,"curl");
 await writeFile(path,mock);await chmod(path,0o755);
 const old={books:[book("a","first-story","en"),book("a-sw","first-story-sw","sw","a"),book("b","old-book","en")],
   chapters:[...["a","a-sw","b"].flatMap(id=>[chapter(id,1,"One "+id),chapter(id,2,"Two "+id)])]};
 const updated={books:[book("a","first-story","en"),book("a-sw","first-story-sw","sw","a"),book("c","new-book","en")],
   chapters:[chapter("a",1,"One a"),chapter("a",2,"Two a revised"),
     chapter("a-sw",1,"One a-sw"),chapter("a-sw",2,"Two a-sw"),
     chapter("c",1,"One c"),chapter("c",2,"Two c")]};
 const oldPath=join(base,"old.json"),newPath=join(base,"new.json");
 await writeFile(oldPath,JSON.stringify(old));await writeFile(newPath,JSON.stringify(updated));
 return {base,bin,oldPath,newPath};
}
async function runBuild(workspace, fixture, bin, since=false) {
 await mkdir(workspace,{recursive:true});
 const env={...process.env,PATH:bin+":"+process.env.PATH,
   NEXT_PUBLIC_SUPABASE_URL:"https://mock.example",
   NEXT_PUBLIC_SUPABASE_ANON_KEY:"public-test",
   SOMA_TEST_FIXTURE:fixture,SOMA_BUILD_TIMESTAMP:"2026-10-09T00:00:00Z"};
 const result=spawnSync(process.execPath,[builder,...(since?["--since"]:[])],
   {cwd:workspace,env,encoding:"utf8",timeout:45000});
 if(result.status!==0)throw new Error("SEO fixture failed: "+result.stdout+"\n"+result.stderr);
 return result.stdout;
}
async function hashes(workspace) {
 const names=await enumerateSeoFiles(join(workspace,"public"));
 const map=new Map();
 for(const rel of names){
  const bytes=await readFile(join(workspace,"public",rel));
  map.set(rel,createHash("sha256").update(bytes).digest("hex"));
 }
 return map;
}
test("full and incremental SEO yield byte-identical generated asset trees for add/change/remove",async(t)=>{
 const f=await makeFixture(t),old=join(f.base,"old"),incremental=join(f.base,"incremental"),fresh=join(f.base,"fresh");
 await runBuild(old,f.oldPath,f.bin);
 await cp(old,incremental,{recursive:true});
 const incLog=await runBuild(incremental,f.newPath,f.bin,true);
 assert.match(incLog,/Incremental:/);
 await runBuild(fresh,f.newPath,f.bin);
 const inc=await hashes(incremental),full=await hashes(fresh);
 assert.deepEqual([...inc.keys()],[...full.keys()]);
 const mismatched=[...inc].filter(([name,hash])=>full.get(name)!==hash).map(([name])=>name);
 assert.deepEqual(mismatched,[],"Full/incremental diverged: "+mismatched.join(", "));
 assert.ok(inc.has("books/new-book/index.html"));
 assert.ok(inc.has("read/new-book/2.html"));
 assert.ok(!inc.has("books/old-book/index.html"));
 assert.ok(!inc.has("read/old-book/1.html"));
 const en=await readFile(join(incremental,"public/books/first-story/index.html"),"utf8");
 const sw=await readFile(join(incremental,"public/books/first-story-sw/index.html"),"utf8");
 assert.match(en,/hreflang="sw"/);
 assert.match(sw,/hreflang="en"/);
});
test("missing chapter source fails SEO instead of quietly preserving incomplete content",async(t)=>{
 const f=await makeFixture(t),workspace=join(f.base,"missing");
 const state=JSON.parse(await readFile(f.newPath,"utf8"));
 state.chapters=state.chapters.filter(ch=>ch.book_id!=="c");
 const path=join(f.base,"missing.json");await writeFile(path,JSON.stringify(state));
 await assert.rejects(runBuild(workspace,path,f.bin),/published book has no published chapters/);
});
test("manifest-says-unchanged but deleted static page is reconstructed",async(t)=>{
 const f=await makeFixture(t),workspace=join(f.base,"restore");
 await runBuild(workspace,f.oldPath,f.bin);
 await rm(join(workspace,"public/read/first-story/1.html"));
 const output=await runBuild(workspace,f.oldPath,f.bin,true);
 assert.match(output,/Incremental:/);
 const recovered=await readFile(join(workspace,"public/read/first-story/1.html"),"utf8");
 assert.match(recovered,/One a/);
});