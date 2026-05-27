// CYP-LEX candidate filter.
// Loads the three CYP-LEX CSVs (ALL AGES + age-banded 7-9 / 10-12), reads
// existing words from KS1 v14 + KS2 v27, applies the requested filters,
// and emits the remaining candidates as CSV (word, zipf, pos, age_band).

import fs from 'node:fs';
import path from 'node:path';

const HOME = '/Users/martinrobertson';
const DL = path.join(HOME, 'Downloads');
const CSV_ALL = path.join(DL, 'CYP-LEX ALL AGES - results.csv');
const CSV_79  = path.join(DL, 'CYP-LEX 7-9 - results.csv');
const CSV_1012 = path.join(DL, 'CYP-LEX 10-12 - results.csv');

const KS1_PATH = path.join(HOME, 'project-X-1/spellify/src/data/ks1WordData_v14.js');
const KS2_PATH = path.join(HOME, 'project-X-1/spellify/src/data/ks2WordData_v27.js');

const OUT = '/tmp/cyp_remaining_v27.csv';

// ── Minimal CSV parser (handles quoted fields, embedded commas) ───────────
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c === '\r') { /* skip */ }
      else cur += c;
    }
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

function loadCyp(file) {
  const txt = fs.readFileSync(file, 'utf8');
  const rows = parseCsv(txt);
  const header = rows[0];
  const idx = {
    word: header.indexOf('Word'),
    lemma: header.indexOf('Lemma'),
    pos: header.indexOf('Most common part of speech'),
    zipf: header.indexOf('Zipf frequency'),
  };
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2) continue;
    const word = (r[idx.word] || '').trim();
    if (!word) continue;
    out.push({
      word,
      lemma: (r[idx.lemma] || '').trim(),
      pos:   (r[idx.pos] || '').trim(),
      zipf:  parseFloat(r[idx.zipf]) || 0,
    });
  }
  return out;
}

// ── Extract existing words from KS data files (regex over source) ─────────
function extractExistingWords(jsPath) {
  const src = fs.readFileSync(jsPath, 'utf8');
  const set = new Set();
  const re = /\bword\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
  let m;
  while ((m = re.exec(src))) {
    set.add(m[1].toLowerCase());
  }
  return set;
}

// ── Filter helpers ────────────────────────────────────────────────────────
// American → British mapping. If candidate word maps to a BrE form that
// exists in either DB, drop the AmE form.
const AME_TO_BRE = new Map(Object.entries({
  color: 'colour', colors: 'colours', colored: 'coloured', coloring: 'colouring',
  favor: 'favour', favors: 'favours', favored: 'favoured', favoring: 'favouring', favorite: 'favourite', favorites: 'favourites',
  flavor: 'flavour', flavors: 'flavours', flavored: 'flavoured', flavoring: 'flavouring',
  honor: 'honour', honors: 'honours', honored: 'honoured', honoring: 'honouring',
  humor: 'humour', humors: 'humours', humored: 'humoured',
  labor: 'labour', labors: 'labours', labored: 'laboured',
  neighbor: 'neighbour', neighbors: 'neighbours', neighborhood: 'neighbourhood', neighborly: 'neighbourly',
  rumor: 'rumour', rumors: 'rumours',
  vapor: 'vapour', vapors: 'vapours',
  vigor: 'vigour',
  savor: 'savour', savory: 'savoury',
  harbor: 'harbour', harbors: 'harbours',
  odor: 'odour', odors: 'odours',
  armor: 'armour', armored: 'armoured',
  behavior: 'behaviour', behaviors: 'behaviours',
  clamor: 'clamour',
  endeavor: 'endeavour',
  glamor: 'glamour',
  parlor: 'parlour',
  tumor: 'tumour',
  center: 'centre', centers: 'centres', centered: 'centred', centering: 'centring',
  theater: 'theatre', theaters: 'theatres',
  meter: 'metre', meters: 'metres',
  liter: 'litre', liters: 'litres',
  fiber: 'fibre', fibers: 'fibres',
  scepter: 'sceptre',
  defense: 'defence', defenses: 'defences',
  offense: 'offence', offenses: 'offences',
  pretense: 'pretence',
  license: 'licence',
  organize: 'organise', organized: 'organised', organizing: 'organising', organization: 'organisation',
  realize: 'realise', realized: 'realised', realizing: 'realising', realization: 'realisation',
  recognize: 'recognise', recognized: 'recognised', recognizing: 'recognising',
  apologize: 'apologise', apologized: 'apologised', apologizing: 'apologising',
  memorize: 'memorise',
  criticize: 'criticise',
  emphasize: 'emphasise',
  analyze: 'analyse', analyzed: 'analysed',
  paralyze: 'paralyse',
  catalog: 'catalogue', catalogs: 'catalogues',
  dialog: 'dialogue', dialogs: 'dialogues',
  program: 'programme', programs: 'programmes',
  jewelry: 'jewellery',
  tire: 'tyre', tires: 'tyres',
  mustache: 'moustache',
  pajamas: 'pyjamas',
  plow: 'plough', plows: 'ploughs',
  gray: 'grey',
  check: 'cheque', checks: 'cheques',
  mom: 'mum', moms: 'mums',
  traveled: 'travelled', traveling: 'travelling', traveler: 'traveller',
  canceled: 'cancelled', canceling: 'cancelling',
  marvelous: 'marvellous',
  woolen: 'woollen',
  modeled: 'modelled', modeling: 'modelling',
  fueled: 'fuelled', fueling: 'fuelling',
  jeweled: 'jewelled',
  draft: 'draught',
  airplane: 'aeroplane',
  aluminum: 'aluminium',
  artifact: 'artefact',
  inquiry: 'enquiry',
  donut: 'doughnut',
  ax: 'axe',
  smolder: 'smoulder',
  mold: 'mould',
  molt: 'moult',
  cozy: 'cosy',
  curb: 'kerb',
  diaper: 'nappy',
  fanny: 'bum',
}));

// Common first names (UK + US, top several hundred each, plus popular
// children's-book / show character names). Lowercased. If a candidate word
// matches this set it's filtered out as a proper name.
// Source: ONS top names + common given names. Trimmed to ones likely to
// appear in CYP-LEX (i.e. already lowercased by the lemmatiser).
const NAMES = new Set(`
oliver olivia harry jack charlie thomas james jacob noah ethan william lucas
mason logan alexander michael benjamin daniel henry leo theodore samuel
sebastian david joseph carter wyatt john owen dylan luke gabriel anthony
isaac grayson jayden mateo julian aaron jaxon eli landon adrian jonathan
nolan jeremiah easton elias colton cameron carson robert angel maverick
nicholas dominic jordan parker austin roman xavier jameson asher
emma sophia isabella ava mia amelia harper evelyn abigail emily ella
elizabeth camila luna sofia avery scarlett aria penelope chloe layla
mila nora hazel madison ellie lily nova isla grace violet aurora riley
zoey willow emilia stella zoe victoria hannah addison leah lucy eliana
ivy everly lillian kinsley natalie maya gianna sarah madelyn ariana audrey
brooklyn bella nevaeh aaliyah ruby claire elena maria savannah aubrey
caroline maddie jasmine kylie ellen daisy poppy florence freya rose grace
ruby millie matilda evie alice maya isabelle imogen mabel iris elsie
beatrice annabelle bonnie connie lottie esme nancy nellie martha mary
margaret elizabeth catherine victoria charlotte alexandra anastasia
george arthur archie freddie albert teddy hugo theo otis felix monty
finn fynn fred edward edmund stanley reuben rupert harvey alfie
ronnie sonny bobby tommy frankie jude joey louie roman elliot rory
samuel solomon stuart simon stephen steven sean shane shaun nathan
nathaniel norman neil nick nigel patrick paul peter philip phillip
quentin ralph raymond rhys richard rick ricky roy russell scott
sidney sydney terry timothy todd tony trevor victor vincent walter
warren wayne wesley harold gerald gary glenn graham gordon greg
howard ian jeff jeffrey jim jimmy keith ken kenneth kevin larry
lawrence lee leonard leroy lewis louis malcolm marcus mark martin
matthew melvin michael mike mitchell andrew aiden aidan adam alan
alex allen alvin andy arnold ashley barry bart ben bernard bert
billy brad bradley brandon brian bruce bryan caleb carl chad
charles chris christopher clarence clark claude clayton clifford
clinton cody colin cory craig curtis darren dave dean dennis derek
derrick don donald douglas duane dustin dwayne earl eddie edgar
ernie eugene fred frederick frank franklin gabe gareth gavin gene
gerald gilbert glen greg gregory grant herbert herman hugh
diana sarah laura emma jessica jennifer michelle nicole rebecca rachel
amanda stephanie melissa kimberly lisa anna angela helen susan donna
carol sandra deborah ruth sharon barbara nancy karen betty maria
patricia linda dorothy mildred margaret edna helen evelyn alice marie
emily anna mary martha katherine kate kathleen karen patricia patrick
joan jean judith judy heather amy beth bethany betsy carla carolyn
catherine cathy cheryl christina christine cindy connie cristina
cynthia dawn deanna debbie debra diane donna dorothy elaine eleanor
ellen erica erin esther ethel eva florence frances gail gina gladys
gloria grace gwen hannah heidi holly hope irene jackie janet janice
jane jean jeanne jeanette jennie jenny jessica jill jodi joan joanna
joanne jocelyn josephine joy joyce judy juanita julia julie june
karen katherine kathleen kathryn kathy katie kaye kelley kelli kelly
kim kimberly kristen kristi kristin kristy laurel lauren lawanda lee
leigh lena leona lillian linda lisa loretta lori lorraine louise lucy
lydia lynette lynn lynne mabel madeline mae marcia margie marian
maria marilyn marjorie marlene martha martina mary maryann maureen
melinda melissa michele michelle mildred millie miranda monica
muriel myrtle nancy nanette naomi natalie nellie nettie nicole
nina norma olga pamela patricia paula pauline pearl peggy phyllis
priscilla rachel rebecca regina rena renee rhonda rita roberta
robin rosa rose rosemary roxanne sally sandra sara shannon sharon
sheila sherri sherry sherrie shirley sonia stacey stacy stella
stephanie sue susan susanna susie suzanne sylvia tammy tara teresa
terri terry theresa tina toni tonia tracy ursula valerie velma
vera veronica vicki vicky victoria violet virginia vivian wanda
wendy whitney wilma yolanda yvette yvonne zelda
caleb cassie cassidy chase chelsea chuck cliff colby colin connor
courtney dale damon darrel daryl davis dexter dirk dustin dwight
elliot enoch erick eric ernest ezekiel fletcher floyd forrest francis
gabriel gerardo gilbert gordon grant guy hank harvey haven hector
hugh humphrey ian ira irving isaiah jake jared jason jasper jay
jed jefferson jeremy jerry jesse jim joel johnnie jonas joseph
joshua julian justin keith kelvin kendall kent kermit kerry kirk
korey kurt kyle lance larry leland leon leslie levi lincoln lionel
lloyd lon lonnie lorenzo louie lowell luther lyle malik manuel
marcus marion marshall marvin maurice max maxwell merle micah miguel
miles milton mitchell morris murray myron neil nelson newton nicolas
norbert nolan oscar pablo perry pete philip pierce porter quincy
rafael randall randy raphael raul reed reggie reginald rene rex
rhys ricardo riley rob roberto rod rodney roger rolando roland ron
ronald rosario ross roy rudolph rudy salvador salvatore sammy
sammie scott shawn sheldon sherman sidney stan stuart sylvester
ted thaddeus theo theodore thomas timmy todd tom tommy tony tony
travis trent trevor troy ty tyler tyrone vaughn vernon victor
vince virgil walter ward warren wendell wesley wilbur willard willie
wilson winston xavier yancy zachary zach zack
ron hermione ginny luna albus severus minerva dumbledore voldemort
neville draco fred george percy bill arthur molly remus sirius regulus
peter pettigrew bellatrix narcissa lucius rubeus rita aberforth nymphadora
katniss peeta gale haymitch effie cinna primrose rue prim madge
edward bella jacob alice rosalie emmett carlisle esme jasper victoria
tris four caleb christina peter eric tobias marcus
percy jackson annabeth grover thalia nico chiron tyson hazel piper
leo frank reyna jason luke ethan zoe bianca rachel silena charles
katie travis connor chris clarisse drew lacy mitchell will lou
hagrid mrs mr ms dr st saint
finn rey kylo poe leia anakin obi yoda chewbacca chewie
mickey minnie donald goofy pluto daisy scrooge huey dewey louie
elsa anna olaf sven kristoff hans simba mufasa nala scar timon
pumbaa rafiki zazu shenzi banzai
bart lisa homer marge maggie milhouse
peppa george suzy danny rebecca emily candy
arthur dw buster francine muffy binky brain fern george sue ellen
fancy nancy bree grace lionel
matilda miss honey wormwood crunchem trunchbull lavender
charlie willy wonka grandpa joe charlie veruca violet mike augustus
ramona beezus henry beatrice
junie joey lucille jim grace bobbi sheldon herb sharon
amelia bedelia
fern wilbur charlotte templeton avery
clifford emily howard ned ellen
ramona quimby
matilda
james giant peach
fudge sheila peter henrietta dribble
greg jodie heffley rowley fregley rodrick manny
percy emily james gordon henry edward thomas duck oliver
maisy charley tallulah cyril
elmer wilbur
spot
biff chip kipper wilf
fiona shrek donkey
ariel sebastian flounder ursula triton eric
woody buzz jessie bullseye andy bonnie ham rex slinky
nemo dory marlin gill bruce squirt crush
mater lightning mcqueen sally
remy emile colette linguini gusteau
wall eve auto
sully mike boo randall waternoose
flik atta dot hopper
sid manny diego scrat ellie peaches
shrek fiona donkey lord farquaad
po tigress shifu oogway viper crane mantis monkey
hiccup astrid stoick gobber snotlout fishlegs ruffnut tuffnut toothless
moana maui tala chief tui pua hei
elsa anna olaf
kristoff sven hans
asha valentino simon dahlia gabo bazeema dario hal saba
mirabel bruno isabela dolores antonio camilo julieta agustin pepa felix
miguel hector imelda mama coco elena
joy sadness anger fear disgust
riley bing bong
michael dwight jim pam ryan andy stanley kevin angela toby phyllis
ted barney robin lily marshall
sheldon leonard penny howard raj amy bernadette
ross rachel monica chandler joey phoebe
walter jesse skyler hank marie saul gus mike
don roger peggy joan pete betty sally
liz jack jenna kenneth tracy
michael janice jordan tobias gob lucille buster maeby
dexter rita debra
homer marge bart lisa maggie
arnold helga gerald phoebe lila rhonda harold patty
spongebob patrick squidward sandy mr krabs gary plankton karen
ash misty brock pikachu jessie james meowth
naruto sasuke sakura hinata kakashi sai itachi gaara temari
goku vegeta gohan piccolo trunks krillin yamcha bulma chichi
monkey nico zoro sanji usopp robin chopper franky brook jinbei
ichigo orihime rukia uryu chad renji byakuya kenpachi
edward alphonse winry roy hawkeye scar mustang armstrong
light l misa rem ryuk near mello soichiro
yusuke kuwabara hiei kurama keiko botan
inuyasha kagome miroku sango shippo kikyo
yugi joey tristan tea kaiba mai
luffy nami robin
sonic tails knuckles amy shadow rouge cream
mario luigi peach daisy yoshi bowser toad rosalina wario waluigi
link zelda ganon ganondorf impa midna sheik
samus ridley
pikachu charizard mewtwo mew
sora donald goofy riku kairi naminé roxas axel xemnas saix xigbar
cloud tifa aerith sephiroth zack barret cid yuffie vincent
squall rinoa selphie zell quistis seifer laguna
tidus yuna lulu wakka rikku auron jecht braska seymour
lightning serah snow hope vanille fang sazh
noctis luna ignis gladio prompto ardyn
2b 9s a2
ellie joel abby tess marlene riley dina
clementine lee carley duck kenny lilly larry doug
arthur dutch john sadie hosea micah javier charles bill lenny sean uncle
ezio altair connor edward jacob evie shay arno bayek alexios kassandra
nathan elena sully chloe rafe nadine sam cassie
desmond miles connor
geralt yennefer triss ciri dandelion zoltan vesemir lambert eskel
deckard ana paragon hayden anthem
master chief cortana arbiter johnson
shepard garrus tali wrex liara mordin grunt jack joker miranda
sebastian alex maru leah penny harvey
peppa danny suzy rebecca freddie zoe richard pedro emily candy edmond
chase marshall rubble rocky zuma skye everest ryder
spot
caillou rosie sarah leo emma andre clementine
diego dora boots swiper
arthur dora boots backpack swiper diego
clifford emily elizabeth tbone cleo
franklin
strawberry shortcake blueberry muffin orange blossom raspberry tart
care bear good cheer wish bedtime
care bear good cheer
mona lisa
santa easter
sophie sofie soph sophia matt mattie lara laura lyra kara cara tara
morrigan ser limpy snape malfoy weasley granger potter dursley dudley
gryffindor slytherin ravenclaw hufflepuff hogwarts
katie kate katy kayla kaylee kaitlin kaitlyn
abby abigail addy addison alex alexa alexis alyssa amy andrea anita
ashley audrey ava bailey bea becky beth bethany blair blake brittany
brooke bryn cami camilla cara carla carly carrie cassidy chelsea
cher chloe christy clara claire courtney cynthia daisy danielle daria
delilah denise destiny diana dora dorothy edith eliza ellen elsie
emerson erica erin esme esther eva fern flora gabby gabriella gemma
georgia gianna gina giselle gracie haley harriet heather helena hilary
hope ida ingrid iris isabel isabella isadora ivy jada jaden janet
jasmine jenna jenny jess jessie jewel joanna jocelyn joelle josephine
josie joy julianne juno karina karla katelyn kayla kelsey kennedy
kiara kiera kim kira kirsten kourtney kristen kristina kylie laila
lana lana lara lauren leila lena leonora lexi lila lilian lily
lindsay liz lola loretta lorraine louise luanne lucinda lucy lulu
lyla mabel mackenzie maddison maddy madeleine madelyn maggie marcie
margot maria mariah marissa marlee martha matilda maureen mavis maxine
megan melanie melinda melissa meredith mia mila millie minerva miranda
miriam molly mollie monica morgan moriah myra nadia nadine naomi nat
natasha nellie nia nicole niamh nina noelle nola nora norah nova ola
olive olivia opal paige paloma pamela patty paula peggy penny phoebe
pippa priya priscilla quinn rachel raelynn ramona raquel reagan rebecca
regina rena renee rhiannon rhonda rita robin rosa rose roxanne ruby
sabrina sadie sage sally samantha sandra sasha selena sheri shirley
sienna simone sloan stacy stella sue summer susan susannah sydney
sylvia tabitha talia tamara tara tasha tessa thea theodora tiana
tilda tina toni tracey trinity trudy uma valentina vanessa veronica
violet vivian vivienne wendy whitney wilhelmina willa willow winona
yara yasmin yolanda zara zelda zinnia zora zoey
aaron abel abraham adrian aidan al alan alec alfie alfonso ali
allan alvin amos anders andre andrew andy angelo ansel anthony
antoine antonio archibald arlo armando arnie arnold artie ashton
augustus austin avery axel barney basil baxter benji bennett bentley
bernard bertie blake bo bobby boyd bram bran branden brandon brock
brody bruno bryant buddy burton byron caleb calvin cameron carter
cedric chad chance chandler chuck cisco clay clayton cliff cole
colin connor conrad cooper corey cornelius corwin cory craig curt
dale damien damon darcy darius darnell darryl dashiell david davis
dawson dax dean delroy dennis dexter dion dom dominic don donovan
dudley dwayne dylan eden edgar edmund eduardo edwin elias elijah
elmer elroy elwood emerson emil emmanuel emmett enrique ernest ernie
ervin esteban ethan eugene evan evander everett ezekiel ezra fabian
felipe felix ferdinand fergus finley flint floyd ford forrest francis
francisco frankie franz fred freddie freddy fritz gabe gabriel garrett
gary gaspard gavin geoff geoffrey gerald gerard gideon gilbert gino
giovanni glen glenn graham grant gray grayson griffin guillermo gus
gustavo guy hank harlan harlow harris harrison harvey hayden hector
henrik henry herbert herman hiram horace howie hudson hugo humphrey
hunter ibrahim ignatius ike isaac isaiah israel ivan jack jacob jake
jameson jamie jared jasper javier jaxon jay jayden jed jeffrey jenson
jerald jerome jerry jesse jett jim jimmy joel johan jonas jonathan
jordan jorge jose joseph josh joshua josiah judah julian julius
junior justin kade kane karl keaton keith kelvin ken kenan kendall
kendrick kenny kenton kermit kerry kevin khalid kieran kingston kirk
klaus knox kurt kyler lance landon lane larry laurence layne lee
leland len leo leon leonard leonardo leopold leroy lester levi lewis
liam lincoln lionel lloyd logan loren lou louis luca lucas lucian
lucius luigi luis luke lyle lyndon mac mack malik manuel marc marcel
marco marcus mario marius mark marlon marshall martin marv marvin
mason matt matteo matthew maurice max maximilian maxwell mel melvin
micah michael miguel mike miles milo milton mitchell monte montgomery
morgan mort moses muhammad murphy murray nash nathan nathaniel ned
nelson nestor nick niall nicholas nico nikolai nils noah noel
norman olaf olin oliver omar oren orin orlando oscar otis otto
owen pablo paolo pascal pat patrick patton paul pedro percival
percy perry peter philip phineas pierce pierre prescott preston quentin
quincy quinn raghav rajiv ralph ramon randall randy raphael ray
raymond reagan reece reed reggie reid remy rene reuben rex rhys
ricardo ricky rico riley rio robbie rocco roderick rodney rodrigo
roger roland rolf roman ronaldo roosevelt rory roscoe ross roy ruben
rudy rufus rupert russell rusty ryan ryker sage salvador sam sammy
samson samuel sanjay santiago sasha saul scott seamus sean sebastian
sergei seth shane shaun sheldon sherwin sidney silas simon sinclair
solomon spencer stan stanley stefan stephen sterling steven stewart
stuart sven sylvester tad tanner tate ted teddy terence theo theodore
thomas tim timmy timothy tobias todd tom tomas tony tracy travis
trent trevor tristan troy ty tyler tyrone tyson ulysses uriah
valentin vance vaughn vernon victor vince vincent virgil vladimir
walt walter ward warren wayne wendell wesley west whit wilbert
wilbur wiley wilford will william willie willis winston wyatt
xander xavier yasin yul yusuf zach zachary zack zane zayden zedekiah
zion ziggy
`.split(/\s+/).filter(Boolean));

// Profanity / inappropriate. Keep this conservative — it's a kids' app.
const PROFANITY = new Set([
  'fuck','fucks','fucked','fucking','fucker',
  'shit','shits','shitty','shitting',
  'bitch','bitches','bitching',
  'cunt','cunts',
  'dick','dicks',
  'cock','cocks',
  'pussy','pussies',
  'piss','pissed','pissing',
  'damn','damned','damning',
  'bastard','bastards',
  'asshole','assholes','arsehole','arseholes',
  'ass','arse','arses',
  'whore','whores',
  'slut','sluts',
  'tit','tits','tittie','titty',
  'crap','crappy',
  'bollocks','wanker','wankers','twat','twats','tosser','tossers',
  'nigger','nigga',
  'fag','fags','faggot','faggots',
  'retard','retards','retarded',
  'porn','porno',
  'sex','sexy','sexual',
  'rape','raped','raping','rapist',
  'kill','killed','killing','killer',  // borderline — comment out if too aggressive
  'murder','murdered','murdering','murderer',
  'drug','drugs','heroin','cocaine','marijuana','meth',
]);
// Remove the borderline kill/murder/drug ones — they appear in legit
// children's literature ("the wind killed the candle", etc).
for (const w of ['kill','killed','killing','killer','murder','murdered','murdering','murderer','drug','drugs']) {
  PROFANITY.delete(w);
}
// Mild oaths / borderline for kids' app — keep these blocked.
for (const w of ['hell','damn','bloody','bugger','buggered','goddamn']) {
  PROFANITY.add(w);
}

// Archaic / obsolete short list. Conservative — only includes forms that are
// distinctly archaic in modern BrE.
const ARCHAIC = new Set([
  'thee','thou','thy','thine','ye',
  'hath','doth','dost','didst','wast','wert','art','shalt','shouldst','wouldst',
  'ere','oft','nay','yea','verily','prithee','hark','lo',
  'forsooth','mayhap','methinks','perchance','betimes','betwixt','anon',
  'twas','tis','o\'er','ne\'er','e\'er',
  'whence','whither','hither','thither','yon','yonder',
  'quoth','sayeth','spake','spoke','wist',
  'bade','clad','quoth',
]);

// Inflection check — derive a plausible base from a candidate. We mostly
// trust the Lemma column; this is a fallback.
function plausibleBase(word) {
  const w = word.toLowerCase();
  const bases = [];
  if (w.endsWith('ies') && w.length > 4) bases.push(w.slice(0, -3) + 'y');
  if (w.endsWith('es')  && w.length > 3) bases.push(w.slice(0, -2));
  if (w.endsWith('s')   && w.length > 2) bases.push(w.slice(0, -1));
  if (w.endsWith('ing') && w.length > 4) {
    bases.push(w.slice(0, -3));
    bases.push(w.slice(0, -3) + 'e');                 // baking → bake
    if (w[w.length - 4] === w[w.length - 5]) bases.push(w.slice(0, -4)); // running → run
  }
  if (w.endsWith('ed') && w.length > 3) {
    bases.push(w.slice(0, -2));
    bases.push(w.slice(0, -1));                       // baked → bake
    if (w[w.length - 3] === w[w.length - 4]) bases.push(w.slice(0, -3)); // stopped → stop
    if (w.endsWith('ied')) bases.push(w.slice(0, -3) + 'y');
  }
  if (w.endsWith('er') && w.length > 3) bases.push(w.slice(0, -2));
  if (w.endsWith('est') && w.length > 4) bases.push(w.slice(0, -3));
  if (w.endsWith('ly') && w.length > 3) bases.push(w.slice(0, -2));
  return bases;
}

// ── Main ──────────────────────────────────────────────────────────────────
console.error('Loading existing KS1/KS2 words…');
const ks1 = extractExistingWords(KS1_PATH);
const ks2 = extractExistingWords(KS2_PATH);
const existing = new Set([...ks1, ...ks2]);
console.error(`  KS1: ${ks1.size}  KS2: ${ks2.size}  combined: ${existing.size}`);

console.error('Loading CYP-LEX CSVs…');
const all   = loadCyp(CSV_ALL);
const a79   = loadCyp(CSV_79);
const a1012 = loadCyp(CSV_1012);
console.error(`  ALL: ${all.length}  7-9: ${a79.length}  10-12: ${a1012.length}`);

const set79 = new Set(a79.map(r => r.word.toLowerCase()));
const set1012 = new Set(a1012.map(r => r.word.toLowerCase()));

// Build candidate map keyed by lowercase word; pick the richest row per word
// (highest Zipf wins ties, e.g. duplicates across files).
const cand = new Map();
for (const r of all) {
  const k = r.word.toLowerCase();
  const prev = cand.get(k);
  if (!prev || r.zipf > prev.zipf) cand.set(k, r);
}
console.error(`  unique candidates: ${cand.size}`);

// Stats
const stats = {
  in_db: 0, propername_caps: 0, propername_pos: 0, propername_list: 0,
  american: 0, inflected: 0, profanity: 0, archaic: 0, empty_or_invalid: 0,
};

const remaining = [];
for (const [k, r] of cand) {
  // Skip empties / single letters / non-word entries
  if (!/^[a-zA-Z][a-zA-Z'\-]+$/.test(r.word)) { stats.empty_or_invalid++; continue; }
  if (r.word.length < 2) { stats.empty_or_invalid++; continue; }

  // Already in DB
  if (existing.has(k)) { stats.in_db++; continue; }

  // Proper noun by capitalisation (raw Word starts uppercase)
  if (/^[A-Z]/.test(r.word)) { stats.propername_caps++; continue; }

  // Proper noun by POS tag
  if (r.pos === 'NNP' || r.pos === 'NNPS') { stats.propername_pos++; continue; }

  // Common first name / character name
  if (NAMES.has(k)) { stats.propername_list++; continue; }

  // Profanity
  if (PROFANITY.has(k)) { stats.profanity++; continue; }

  // Archaic
  if (ARCHAIC.has(k)) { stats.archaic++; continue; }

  // American spelling where BrE form exists in DB.
  // Check both the direct BrE form and its plausible base (so e.g. AmE
  // "realized" → BrE "realised" still drops when DB only stores "realise").
  const bre = AME_TO_BRE.get(k);
  if (bre) {
    if (existing.has(bre)) { stats.american++; continue; }
    if (plausibleBase(bre).some(b => existing.has(b))) { stats.american++; continue; }
  }

  // Inflected-only forms where base exists in DB
  const lemma = (r.lemma || '').toLowerCase();
  if (lemma && lemma !== k && existing.has(lemma)) { stats.inflected++; continue; }
  // Fallback: regex base check
  if (!lemma || lemma === k) {
    const bases = plausibleBase(k);
    if (bases.some(b => existing.has(b))) { stats.inflected++; continue; }
  }

  // Age band assignment
  let band;
  if (set79.has(k)) band = '7-9';
  else if (set1012.has(k)) band = '10-12';
  else band = 'all';      // CBeebies-or-other; not in either banded file

  remaining.push({ word: r.word, zipf: r.zipf, pos: r.pos, age_band: band });
}

// Sort by zipf desc, then word asc
remaining.sort((a, b) => b.zipf - a.zipf || a.word.localeCompare(b.word));

// Write CSV
function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const lines = ['word,zipf,pos,age_band'];
for (const r of remaining) {
  lines.push([csvEscape(r.word), r.zipf, csvEscape(r.pos), csvEscape(r.age_band)].join(','));
}
fs.writeFileSync(OUT, lines.join('\n') + '\n');

console.error('\nFilter stats:');
for (const [k, v] of Object.entries(stats)) console.error(`  ${k.padEnd(20)} ${v}`);
console.error(`\nRemaining candidates: ${remaining.length}`);
console.error(`Written: ${OUT}`);
