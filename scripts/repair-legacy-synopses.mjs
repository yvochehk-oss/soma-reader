import { readFile } from "node:fs/promises";
import { fetchJsonWithRetry, getImportToken } from "./lib/soma-release-http.mjs";

const source = await readFile(new URL("../src/lib/supabase-books.ts", import.meta.url), "utf8");
const value = (name) => source.match(new RegExp(`const ${name} =[^']*'([^']+)'`))?.[1] || "";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || value("SUPABASE_URL");
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || value("SUPABASE_ANON_KEY");
if (!url || !key) throw new Error("Missing Supabase public configuration.");
const headers = { apikey: key, authorization: `Bearer ${key}` };
const generic = "A captivating bilingual story from Kenya.";
const descriptions = {
  "the-house-that-wasn-t-sold": [
    "When a disputed Nairobi house refuses to change hands, a determined daughter uncovers forged land records, a family betrayal and the hidden reason powerful buyers need the property.",
    "Nyumba iliyogombaniwa Nairobi inakataa kuuzwa; binti shupavu anagundua hati bandia, usaliti wa familia na sababu ya siri inayowasukuma wanunuzi wenye nguvu."
  ],
  "map-of-the-black-river": [
    "Drone surveyor Kassim Mbarouk discovers a flood map that moves the Black River uphill and carries his forged approval. To save villages, a dam and their land rights, he must expose a mineral corridor and the plan to manufacture a disaster.",
    "Mtaalamu wa ramani Kassim Mbarouk agundua ramani bandia ya mafuriko inayopandisha Mto Mweusi mlimani na kubeba idhini yake ya kughushiwa. Ili kuokoa vijiji, bwawa na haki za ardhi, lazima afichue ukanda wa madini na mpango wa kutengeneza maafa."
  ],
  "the-sound-of-the-bridge": [
    "Structural engineer Malik Odhiambo hears a fatal pulse in a Nairobi bridge, then finds a dead inspector's signature on records blaming him for counterfeit steel. His search reveals a conspiracy that manufactures emergencies for lucrative contracts.",
    "Mhandisi Malik Odhiambo asikia mpigo wa hatari kwenye daraja la Nairobi, kisha aona sahihi ya mkaguzi aliyekufa kwenye hati zinazomlaumu kwa chuma bandia. Uchunguzi wake wafichua njama ya kutengeneza dharura kwa mikataba ya faida."
  ],
  "the-final-measure": [
    "A careful auditor finds that one missing measurement could decide a family's future. As powerful officials rewrite the records, she races to recover the original evidence before a public verdict becomes permanent.",
    "Mkaguzi makini agundua kuwa kipimo kimoja kilichopotea kinaweza kuamua mustakabali wa familia. Viongozi wenye nguvu wanapobadilisha kumbukumbu, anakimbia kupata ushahidi wa kwanza kabla ya hukumu ya umma kuwa ya kudumu."
  ],
  "container-forty-seven": [
    "A sealed shipping container in Mombasa links a missing worker, a falsified manifest and a dangerous corporate secret. One investigator must open Container Forty-Seven before the evidence is moved—or buried.",
    "Kontena lililofungwa Mombasa linaunganisha mfanyakazi aliyepotea, manifesti bandia na siri hatari ya kampuni. Mpelelezi mmoja lazima alifungue Kontena la Arobaini na Saba kabla ushahidi haujahamishwa au kufukiwa."
  ],
  "ninety-minutes-of-darkness": [
    "When Nairobi loses power for ninety minutes, a young technician discovers the blackout is a cover for a coordinated theft. Every minute brings a new danger as she follows the hidden circuit back to the people who ordered the darkness.",
    "Nairobi inapopoteza umeme kwa dakika tisini, fundi mchanga agundua kuwa giza ni kifuniko cha wizi uliopangwa. Kila dakika huleta hatari mpya anapofuatilia njia ya siri hadi kwa walioamuru giza."
  ],
  "zuri-queen-of-fashion": [
    "Zuri's fashion empire is stolen by the people who once dismissed her. With a final collection, a buried contract and an ally no one expects, she turns a public humiliation into a brilliant comeback.",
    "Dola la mitindo la Zuri linaibwa na watu waliowahi kumdharau. Kwa mkusanyiko wa mwisho, mkataba uliofichwa na mshirika asiyetarajiwa, anageuza fedheha ya hadharani kuwa ushindi mkubwa."
  ],
  "voices-beneath-the-baobab": [
    "A village hears voices beneath an ancient baobab after a developer announces a sudden eviction. A teacher and a reluctant heir follow the clues through oral history, missing documents and a land deal built on silence.",
    "Kijiji chasikia sauti chini ya mbuyu wa kale baada ya mwekezaji kutangaza kufukuzwa kwao. Mwalimu na mrithi asiyetaka hufuata dalili kupitia historia ya simulizi, hati zilizopotea na dili la ardhi lililojengwa juu ya ukimya."
  ],
  "i-returned-before-the-wedding": [
    "She returns to Nairobi before her wedding and finds the family business, her name and her future already promised to someone else. The truth behind the betrayal gives her one chance to reclaim everything in public.",
    "Anarudi Nairobi kabla ya harusi na kukuta biashara ya familia, jina lake na mustakabali wake vimeahidiwa kwa mtu mwingine. Ukweli wa usaliti huo humpa nafasi moja ya kudai kila kitu mbele ya umma."
  ],
  "the-last-seven-minutes": [
    "A missing title deed, a locked registry and seven minutes before a forced transfer put one community's homes at risk. A dismissed clerk turns overlooked records into the proof that can stop the sale.",
    "Hati ya mwisho iliyopotea, sajili iliyofungwa na dakika saba kabla ya uhamisho wa lazima vinahatarisha nyumba za jamii. Karani aliyedharauliwa ageuza kumbukumbu zilizopuuzwa kuwa ushahidi wa kusimamisha mauzo."
  ],
  "the-last-title-deed": [
    "When the last title deed disappears from a crowded land office, an accused clerk follows its trail through forged signatures and a powerful developer's secret bargain.",
    "Hati ya mwisho inapopotea kwenye ofisi yenye msongamano, karani anayetuhumiwa afuatilia njia yake kupitia sahihi bandia na makubaliano ya siri ya mwekezaji mwenye nguvu."
  ],
  "i-returned-on-the-day-of-division": [
    "On the day her family divides its land, a woman returns with evidence that the inheritance was rigged. She must face the relatives who erased her and force the real accounts into the open.",
    "Siku ambayo familia yake inagawanya ardhi, mwanamke arudi na ushahidi kuwa urithi ulipangwa kwa udanganyifu. Lazima awakabili ndugu waliomfuta na kuweka hesabu za kweli wazi."
  ],
  "the-daughter-they-rejected": [
    "Rejected by her family and written out of their company, a daughter returns with the knowledge that can expose their biggest fraud. Her quiet comeback becomes an undeniable public reckoning.",
    "Familia yake ilimkataa na kumfuta kwenye kampuni, lakini binti arudi na maarifa yanayoweza kufichua ulaghai wao mkubwa. Kurudi kwake kwa utulivu kunageuka kuwa hukumu ya wazi isiyokanushwa."
  ],
  "the-daughter-who-awoke-on-proposal-day": [
    "On the morning of her proposal, Zawadi wakes to a stolen code, a family alliance built on fraud and a future chosen without her. She turns the betrayal into the first move of a powerful new life on the coast.",
    "Asubuhi ya posa yake, Zawadi aamke na kugundua msimbo ulioibwa, muungano wa familia uliojengwa kwa ulaghai na mustakabali uliochaguliwa bila yeye. Ageuza usaliti huo kuwa hatua ya kwanza ya maisha mapya yenye nguvu pwani."
  ],
  "fired-on-my-wedding-day": [
    "Dismissed on her wedding day, a woman discovers that the firing is part of a scheme to seize her work and silence her. She returns with the evidence, the allies and the courage to reclaim her name in public.",
    "Anapofutwa kazi siku ya harusi yake, mwanamke agundua kuwa kufukuzwa ni sehemu ya njama ya kutwaa kazi yake na kumnyamazisha. Arudi na ushahidi, washirika na ujasiri wa kudai jina lake mbele ya umma."
  ]
};
const swToEn = new Map([
  ["ramani-ya-mto-mweusi-sw", "map-of-the-black-river"], ["nyumba-isiyouzwa-sw", "the-house-that-wasn-t-sold"],
  ["mlio-wa-daraja-sw", "the-sound-of-the-bridge"], ["kipimo-cha-mwisho-sw", "the-final-measure"],
  ["kontena-la-arobaini-na-saba-sw", "container-forty-seven"], ["dakika-tisini-za-giza-sw", "ninety-minutes-of-darkness"],
  ["zuri-malkia-wa-mitindo-sw", "zuri-queen-of-fashion"], ["sauti-chini-ya-mbuyu-sw", "voices-beneath-the-baobab"],
  ["nilirudi-kabla-ya-harusi-sw", "i-returned-before-the-wedding"], ["dakika-saba-za-mwisho-sw", "the-last-seven-minutes"],
  ["hati-ya-mwisho-sw", "the-last-title-deed"], ["nilirudi-siku-ya-mgawanyo-sw", "i-returned-on-the-day-of-division"],
  ["binti-waliyemkataa-sw", "the-daughter-they-rejected"]
  , ["nilifukuzwa-siku-ya-harusi-sw", "fired-on-my-wedding-day"]
  , ["binti-aliyeamka-siku-ya-posa-sw", "the-daughter-who-awoke-on-proposal-day"]
]);
const get = async (path) => { const res = await fetch(`${url}/rest/v1/${path}`, { headers }); if (!res.ok) throw new Error(`${res.status} ${path}`); return res.json(); };
const books = await get("books?select=id,parent_book_id,slug,title,author_name,description,cover_url,language_code,category,tags,status,is_featured,published_at&description=eq." + encodeURIComponent(generic));
if (books.length !== 29) throw new Error(`Expected 29 legacy books, found ${books.length}.`);
const byId = new Map(books.map((book) => [book.id, book]));
const payload = [];
for (const book of books) {
  const enSlug = book.language_code === "en" ? book.slug : swToEn.get(book.slug);
  const pair = descriptions[enSlug];
  if (!pair) throw new Error(`No synopsis mapping for ${book.slug}`);
  const rows = await get(`chapters?select=chapter_number,title,content,status,is_free&book_id=eq.${book.id}&order=chapter_number.asc`);
  const chapters = rows.map((chapter) => ({ number: chapter.chapter_number, title: chapter.title, content: chapter.content, status: chapter.status, isFree: chapter.is_free }));
  const parent = book.parent_book_id ? byId.get(book.parent_book_id) : null;
  payload.push({ slug: book.slug, title: book.title, author: book.author_name || "Soma Originals", language: book.language_code, category: ["Romance", "Thriller", "Sci-Fi", "Historical", "Fantasy", "Contemporary", "Urban Fantasy"].find((item) => item.toLowerCase() === String(book.category || "").toLowerCase()) || "Thriller", tags: book.tags?.length ? book.tags : ["Thriller"], description: book.language_code === "sw" ? pair[1] : pair[0], status: book.status, featured: book.is_featured === true, coverUrl: book.cover_url, translationOfSlug: parent?.slug, chapters });
}
const token = getImportToken(); if (!token) throw new Error("No Soma import token found.");
const api = "https://somanovel.uk/api/internal/book-import";
for (let i = 0; i < payload.length; i += 10) {
  const batch = payload.slice(i, i + 10);
  const result = await fetchJsonWithRetry(api, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ books: batch }) }, { label: `Synopsis update batch ${i / 10 + 1}` });
  if (!result.response.ok) throw new Error(result.result.error || `Upload failed (${result.response.status})`);
  console.log(`Updated ${result.result.importedBooks} books / ${result.result.importedChapters} chapters.`);
}
console.log("Legacy synopsis repair complete.");
