/**
 * wordValidation.js
 *
 * Validates and classifies OCR candidate strings against a word bank
 * built from:
 *   - the UK statutory spelling lists (Year 1 → Year 6)
 *   - a curated set of high-frequency English words and common spelling-list
 *     vocabulary used in primary classrooms
 *
 * The output of `classifyCandidate` drives the OcrReview UI: it decides
 * whether each scanned word is shown as confident, needs-review, or
 * rejected, and surfaces a suggested correction when one looks safe.
 */

import { YEAR_DATA } from '../data/spelling/index.js';

// ── 1. Word bank ──────────────────────────────────────────────────────────

/**
 * A pragmatic dictionary aimed at primary-school spelling lists. Not a
 * full English dictionary by design — too large hurts perf and inflates
 * false positives. Tuned for the kinds of words a Year 1–Year 6 child is
 * likely to be tested on.
 */
const COMMON_WORDS = [
  // Articles, pronouns, conjunctions, determiners
  'a','an','and','as','at','be','but','by','for','if','in','is','it','no','of',
  'on','or','so','the','to','up','we','you','he','she','they','them','their',
  'his','her','our','your','my','me','us','i','am','are','was','were','will',
  'would','should','could','can','may','might','must','do','does','did','done',
  'have','has','had','this','that','these','those','here','there','where',
  'when','why','how','what','who','whom','whose','which',
  // Numbers and time
  'one','two','three','four','five','six','seven','eight','nine','ten',
  'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen',
  'eighteen','nineteen','twenty','thirty','forty','fifty','sixty','seventy',
  'eighty','ninety','hundred','thousand','million','first','second','third',
  'fourth','fifth','sixth','seventh','eighth','ninth','tenth','last','next',
  'today','tomorrow','yesterday','morning','afternoon','evening','night',
  'monday','tuesday','wednesday','thursday','friday','saturday','sunday',
  'january','february','march','april','may','june','july','august',
  'september','october','november','december','spring','summer','autumn','winter',
  // Family / people
  'mother','father','mum','mom','dad','brother','sister','baby','child','kids',
  'family','friend','friends','people','person','boy','girl','man','woman',
  'men','women','aunt','uncle','grandma','grandpa','granny','grandad','cousin',
  // Body
  'head','hair','face','eye','eyes','ear','ears','nose','mouth','tooth','teeth',
  'tongue','arm','arms','hand','hands','finger','leg','legs','foot','feet',
  'toe','toes','heart','brain','skin','bone','knee','elbow',
  // Colours and shapes
  'red','orange','yellow','green','blue','purple','pink','brown','black','white',
  'grey','gray','gold','silver','colour','color','colours','colors','rainbow',
  'circle','square','triangle','rectangle','star','heart','round','shape',
  // Animals
  'cat','dog','rabbit','mouse','rat','bird','fish','frog','horse','cow','sheep',
  'pig','goat','duck','chicken','hen','rooster','goose','turkey','lamb','calf',
  'puppy','kitten','tiger','lion','bear','wolf','fox','deer','snake','spider',
  'bee','ant','butterfly','elephant','giraffe','monkey','zebra','panda','koala',
  'kangaroo','dolphin','whale','shark','octopus','penguin','owl','eagle',
  'parrot','peacock','hippo','rhino','crocodile','dinosaur','dragon','unicorn',
  'animal','animals','pet','pets',
  // School & home
  'school','class','classroom','teacher','student','pupil','homework','book',
  'books','pen','pens','pencil','pencils','paper','desk','chair','table','door',
  'window','floor','wall','ceiling','room','bedroom','kitchen','bathroom',
  'garden','house','home','flat','apartment','bed','sofa','lamp','clock','tv',
  'phone','computer','laptop','tablet','game','games','toy','toys','ball',
  'doll','train','car','bus','truck','bike','plane','ship','boat','rocket',
  // Food
  'food','breakfast','lunch','dinner','tea','snack','meal','cake','biscuit',
  'cookie','bread','butter','jam','honey','sugar','salt','pepper','milk','egg',
  'eggs','cheese','yoghurt','yogurt','meat','beef','chicken','fish','rice',
  'pasta','noodles','soup','sandwich','pizza','chips','fries','crisps','fruit',
  'apple','banana','orange','grape','grapes','pear','peach','plum','cherry',
  'cherries','strawberry','strawberries','raspberry','blueberry','melon',
  'pineapple','mango','kiwi','lemon','lime','vegetable','vegetables','potato',
  'potatoes','tomato','tomatoes','carrot','onion','peas','beans','corn',
  'cabbage','lettuce','cucumber','broccoli','mushroom','garlic','water','juice',
  'lemonade','coffee','chocolate','sweet','sweets','candy','ice','cream',
  // Outdoors / nature
  'sun','moon','star','stars','cloud','clouds','sky','rain','snow','wind',
  'storm','thunder','lightning','rainbow','tree','trees','leaf','leaves','flower',
  'flowers','grass','plant','plants','seed','root','branch','forest','wood',
  'park','beach','sea','ocean','river','lake','pond','stream','mountain','hill',
  'valley','field','farm','road','street','path','bridge','town','city',
  'village','country','world','earth','planet','rock','stone','sand','mud',
  // Verbs
  'go','goes','went','gone','come','comes','came','run','runs','ran','walk',
  'walks','walked','walking','jump','jumps','jumped','sit','sits','sat',
  'stand','stood','look','looks','looked','see','sees','saw','seen','watch',
  'watches','hear','heard','listen','say','said','tell','told','speak','spoke',
  'talk','talks','ask','asked','answer','read','write','wrote','spell','play',
  'played','sing','sang','dance','laugh','cry','smile','help','helped',
  'work','worked','make','made','take','took','give','gave','put','find',
  'found','want','need','like','liked','love','loved','hate','feel','felt',
  'think','thought','know','knew','open','close','start','stop','finish',
  'try','tried','keep','kept','catch','caught','throw','threw','build','built',
  'break','broke','fix','clean','wash','cook','eat','ate','drink','drank',
  'sleep','slept','wake','woke','dream','rest','live','lived','die','died',
  'grow','grew','learn','learned','learnt','teach','taught','remember','forget',
  'forgot','wait','waited','meet','met','win','won','lose','lost','buy','sell',
  'pay','paid','count','add','take','share','swim','swam','climb','climbed',
  'fly','flew','ride','rode','drive','drove','push','pull','carry','bring',
  'send','show','showed','hide','hid','seek','choose','chose','pick','drop',
  'spill','wear','wore','dress','tie','open','closed','smell','taste','touch',
  // Common nouns
  'name','word','words','letter','letters','sound','sounds','number','numbers',
  'thing','things','idea','story','stories','song','poem','picture','pictures',
  'photo','photos','painting','drawing','game','match','team','race','ride',
  'trip','journey','holiday','vacation','party','present','gift','card','flag',
  'box','bag','basket','bottle','cup','glass','plate','bowl','spoon','fork',
  'knife','pot','pan','key','lock','door','window','roof','floor','stair',
  'stairs','garden','fence','gate','tree','treehouse','house','home','town',
  'shop','store','market','library','museum','hospital','clinic','dentist',
  'doctor','nurse','firefighter','police','soldier','sailor','farmer','baker',
  'cook','chef','singer','actor','dancer','artist','writer','painter','builder',
  'driver','pilot','captain','king','queen','prince','princess','knight',
  'wizard','witch','fairy','monster','ghost','giant','hero','heroine',
  // Adjectives
  'big','small','tiny','huge','large','little','tall','short','long','wide',
  'narrow','high','low','deep','shallow','thick','thin','heavy','light','fast',
  'slow','quick','strong','weak','soft','hard','smooth','rough','clean','dirty',
  'wet','dry','hot','warm','cool','cold','icy','sunny','rainy','windy','snowy',
  'cloudy','bright','dark','loud','quiet','silent','noisy','happy','sad','angry',
  'cross','glad','scared','afraid','brave','kind','nice','mean','rude','polite',
  'funny','silly','clever','smart','wise','silly','easy','hard','difficult',
  'simple','careful','careless','lucky','rich','poor','old','young','new','same',
  'different','important','special','beautiful','pretty','lovely','cute','ugly',
  'good','bad','best','worst','better','worse','great','wonderful','amazing',
  'fantastic','perfect','correct','wrong','right','left','front','back','near',
  'far','close','open','full','empty','round','flat','sharp','dull','sour',
  'sweet','salty','spicy','bitter','tasty','yummy','delicious',
  // Adverbs / common short words
  'very','really','quite','almost','just','still','again','always','never',
  'often','sometimes','soon','later','before','after','now','then','here',
  'there','everywhere','nowhere','somewhere','anywhere','inside','outside','up',
  'down','over','under','above','below','between','through','around','across',
  'into','onto','off','out','away','back','forward','together','apart','also',
  'only','even','too','either','neither','both','all','every','each','some',
  'any','many','much','more','most','few','less','least','enough','about',
  // Tricky / common confusions
  'because','beautiful','people','knew','knee','knife','know','know','known',
  'enough','through','though','although','tough','rough','laugh','daughter',
  'eight','weight','height','neighbour','neighbor','believe','receive','piece',
  'friend','friends','because','quiet','quite','quit','their','there','they',
  'then','than','were','where','we','wear','tear','near','dear','heart',
  'earth','search','learn','heard','hearth','listen','often','never','always',
  'really','already','almost','answer','any','anyway','everyone','everything',
  'anybody','somebody','nobody','anybody','someone','machine','school','choir',
  'chemist','chord','character','archive','stomach','echo','technology',
  'photograph','telephone','elephant','dolphin','phone','laugh','tough','enough',
  'rough','cough','knight','knock','knot','knew','know','wrap','write','wrong',
  'wrist','sword','answer','climb','lamb','comb','thumb','crumb','dumb',
  'autumn','column','calf','half','calm','palm','psalm','island','aisle',
  'guess','guest','guide','guard','vague','plague','league',
  // Phonics rhyming families — common in primary spelling lists.
  // -ow (long o)
  'blow','crow','flow','glow','grow','low','mow','row','show','slow','snow','tow','throw','bow','below','flown','grown','known','shown','thrown',
  // -ay
  'bay','day','hay','jay','lay','may','nay','pay','ray','say','way','play','stay','spray','stray','today','away','holiday','tray','clay','gray',
  // -ee
  'bee','fee','see','tree','three','knee','free','agree','flee','wee',
  // -oo (short and long)
  'boo','moo','too','zoo','book','cook','hook','look','took','rook','foot','wood','good','hood','stood',
  'food','mood','room','soon','moon','spoon','boot','shoot','loop','hoop','school','tool','pool',
  // -ight / -igh
  'high','sigh','thigh','light','might','night','right','sight','tight','fight','bright','flight','fright','plight','slight','knight','ought','bought','thought','brought',
  // -all
  'all','ball','call','fall','hall','tall','wall','small','stall','recall',
  // -ing
  'sing','ring','king','wing','thing','bring','spring','string','sting','swing','cling',
  // -an / -at / -ad short vowel
  'cat','bat','hat','mat','pat','rat','sat','that','flat','chat','splat',
  'can','fan','man','pan','ran','tan','than','plan','span',
  'bad','dad','had','mad','sad','glad',
  // -ick / -ock / -uck
  'kick','lick','pick','sick','tick','brick','quick','stick','thick','trick','chick','click','flick',
  'cock','dock','lock','mock','rock','sock','block','clock','flock','frock','knock','shock','stock',
  'duck','luck','muck','puck','suck','tuck','cluck','pluck','stuck','struck','truck',
  // -ake / -ame / -ate
  'bake','cake','fake','lake','make','rake','sake','take','wake','brake','flake','shake','snake','stake',
  'came','dame','fame','game','lame','name','same','tame','blame','flame','frame','shame',
  'date','fate','gate','hate','late','mate','rate','create','plate','slate','state','skate',
  // -ip / -op / -ump
  'dip','hip','lip','rip','sip','tip','zip','chip','clip','drip','flip','grip','ship','skip','slip','snip','trip','whip',
  'cop','hop','mop','pop','top','chop','crop','drop','flop','plop','prop','shop','stop',
  'bump','dump','hump','jump','lump','pump','rump','sump','grump','plump','slump','stump','thump','trump',
  // Long vowel patterns
  'rain','main','pain','train','brain','chain','plain','stain','grain',
  'meet','feet','greet','sheet','sweet','tweet','street',
  'beach','reach','teach','peach','speech','preach','breach',
  // Common everyday additions that came up missing
  'arm','art','ask','axe','barn','bee','bell','bird','blue','boy','bus','can','car','cap',
  'corn','cube','dance','duck','duty','easy','egg','enjoy','exit','farm','fast','fit','fox',
  'fun','gas','gem','grain','green','ham','hat','hop','huge','ice','ink','jam','jet','joy',
  'jug','key','kid','lad','lap','log','map','milk','mix','mud','nap','nest','net','nut',
  'oak','ox','pad','pet','pig','pin','pop','rag','rib','rod','roof','rope','rug','sad',
  'sat','seal','seat','shoe','sit','six','sky','soap','sock','soft','spot','tap','tea','ten',
  'tent','tip','top','tub','vet','wax','wig','win','yes','zip',
];

const ALL_WORDS = new Set();

// Add UK curriculum (already verified as canonical spelling-list vocabulary)
for (const yearKey of Object.keys(YEAR_DATA)) {
  for (const w of YEAR_DATA[yearKey].words) {
    ALL_WORDS.add(w.toLowerCase());
  }
}
for (const w of COMMON_WORDS) {
  ALL_WORDS.add(w.toLowerCase());
}

/**
 * Group words by length to keep fuzzy-match scans tractable. We'll only
 * compare against words within ±2 length when looking for corrections.
 */
const WORDS_BY_LEN = new Map();
for (const w of ALL_WORDS) {
  const len = w.length;
  if (!WORDS_BY_LEN.has(len)) WORDS_BY_LEN.set(len, []);
  WORDS_BY_LEN.get(len).push(w);
}

export function isInWordBank(word) {
  return ALL_WORDS.has(word.toLowerCase());
}

// ── 2. Normalisation ──────────────────────────────────────────────────────

/**
 * Lowercase, strip non-letter characters except apostrophes/hyphens, and
 * trim. Returns '' if there's nothing usable left.
 */
export function normalizeWord(raw) {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z'-]/g, '')
    .replace(/^[-']+|[-']+$/g, '') // trim apostrophes/hyphens at edges
    .trim();
}

const VOWEL_RE = /[aeiouy]/;

/**
 * Reject obvious garbage: too short, too long, no vowels, repeated single
 * letters ('lllll'), or alternating noise ('lthrow' from a box border).
 */
export function looksLikeJunk(word) {
  if (!word) return true;
  if (word.length < 3) return true;
  if (word.length > 20) return true;
  if (!VOWEL_RE.test(word)) return true;
  // Same letter ≥ 4 times in a row
  if (/(.)\1{3,}/.test(word)) return true;
  // Single character repeated
  if (new Set(word).size === 1) return true;
  return false;
}

// ── 3. Damerau–Levenshtein distance ───────────────────────────────────────

/**
 * Damerau–Levenshtein distance with an early-exit cap. Returns Infinity
 * if the distance would exceed `max`.
 */
export function damerauLevenshtein(a, b, max = Infinity) {
  if (a === b) return 0;
  const aLen = a.length;
  const bLen = b.length;
  if (Math.abs(aLen - bLen) > max) return Infinity;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  // Two-row optimisation isn't enough for transpositions — keep three rows.
  const prevPrev = new Array(bLen + 1);
  const prev     = new Array(bLen + 1);
  const curr     = new Array(bLen + 1);

  for (let j = 0; j <= bLen; j++) prev[j] = j;

  for (let i = 1; i <= aLen; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(
        curr[j - 1] + 1,        // insertion
        prev[j]     + 1,        // deletion
        prev[j - 1] + cost,     // substitution
      );
      if (
        i > 1 && j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        v = Math.min(v, prevPrev[j - 2] + 1); // transposition
      }
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return Infinity;
    // Rotate rows: prevPrev ← prev ← curr
    for (let j = 0; j <= bLen; j++) {
      prevPrev[j] = prev[j];
      prev[j]     = curr[j];
    }
  }
  return prev[bLen];
}

// ── 4. Fuzzy match ────────────────────────────────────────────────────────

/**
 * Find the best matches for `word` in the word bank within `maxDistance`.
 * Returns an array of `{ word, distance }` sorted by distance, capped at
 * `limit`. A small length window keeps this fast — comparing 'cat' to
 * 'pterodactyl' is never going to match.
 */
export function findCorrections(word, { maxDistance = 2, limit = 3 } = {}) {
  const w = word.toLowerCase();
  if (!w) return [];
  if (ALL_WORDS.has(w)) return [{ word: w, distance: 0 }];

  const matches = [];
  for (let len = w.length - maxDistance; len <= w.length + maxDistance; len++) {
    const bucket = WORDS_BY_LEN.get(len);
    if (!bucket) continue;
    for (const cand of bucket) {
      const d = damerauLevenshtein(w, cand, maxDistance);
      if (d <= maxDistance) matches.push({ word: cand, distance: d });
    }
  }
  matches.sort((a, b) => a.distance - b.distance || a.word.localeCompare(b.word));
  return matches.slice(0, limit);
}

// ── 5. Classification ─────────────────────────────────────────────────────

/**
 * Statuses returned to the UI.
 */
export const STATUS = Object.freeze({
  CONFIDENT:    'confident',
  NEEDS_REVIEW: 'needsReview',
  REJECTED:     'rejected',
});

/**
 * Classify a single OCR candidate.
 *
 * Inputs:
 *  - rawText:         the OCR token (will be normalised internally)
 *  - ocrConfidence:   0–100 from Tesseract; missing ⇒ assume 70
 *  - boundingBox:     optional {x0,y0,x1,y1}
 *  - source:          'ocr' | 'manual' | 'fuzzy'
 *
 * Decision rules:
 *   1. Junk (no vowels / too short / repeated chars) → rejected.
 *   2. Exact dictionary hit + decent OCR confidence → confident.
 *   3. Exactly one suggestion at distance 1 + high OCR conf → confident,
 *      with `suggestedText` set; UI defaults to using the suggestion.
 *   4. Multiple plausible suggestions OR low OCR conf → needsReview.
 *   5. No dictionary match within distance 2 → needsReview only if the
 *      candidate at least looks word-like; otherwise rejected.
 */
export function classifyCandidate({
  rawText,
  ocrConfidence = 70,
  boundingBox   = null,
  source        = 'ocr',
} = {}) {
  const candidateText = normalizeWord(rawText);

  const base = {
    candidateText,
    suggestedText: null,
    confirmedText: candidateText,
    confidence:    ocrConfidence,
    boundingBox,
    source,
    alternatives:  [],
    status:        STATUS.REJECTED,
  };

  // Manual entries trust the user.
  if (source === 'manual') {
    if (!candidateText || candidateText.length < 2) return { ...base, status: STATUS.REJECTED };
    return { ...base, status: STATUS.CONFIDENT };
  }

  if (looksLikeJunk(candidateText)) {
    return base; // rejected
  }

  // Exact match
  if (ALL_WORDS.has(candidateText)) {
    return {
      ...base,
      status:        ocrConfidence >= 60 ? STATUS.CONFIDENT : STATUS.NEEDS_REVIEW,
      confirmedText: candidateText,
    };
  }

  const corrections = findCorrections(candidateText, { maxDistance: 2, limit: 3 });

  if (corrections.length === 0) {
    // No dictionary support — let the user vouch for it.
    return {
      ...base,
      status: STATUS.NEEDS_REVIEW,
    };
  }

  const best = corrections[0];
  const tied = corrections.filter((c) => c.distance === best.distance);

  // Single strong suggestion at distance 1 with confident OCR → auto-suggest.
  if (
    tied.length === 1 &&
    best.distance === 1 &&
    ocrConfidence >= 75 &&
    candidateText.length >= 4
  ) {
    return {
      ...base,
      status:        STATUS.CONFIDENT,
      suggestedText: best.word,
      confirmedText: best.word,
      alternatives:  corrections.map((c) => c.word),
    };
  }

  // Anything else with a plausible correction goes to review with the
  // top suggestion shown but NOT silently applied.
  return {
    ...base,
    status:        STATUS.NEEDS_REVIEW,
    suggestedText: best.word,
    confirmedText: candidateText,
    alternatives:  corrections.map((c) => c.word),
  };
}

/**
 * Classify a list of candidates and dedupe by confirmedText, keeping the
 * highest-confidence copy. Always preserves order of first appearance.
 */
export function classifyCandidates(candidates) {
  const out  = [];
  const seen = new Map(); // confirmedText → index in out

  for (const c of candidates) {
    const classified = classifyCandidate(c);
    if (classified.status === STATUS.REJECTED) continue;
    const key = classified.confirmedText;
    if (!key) continue;
    if (seen.has(key)) {
      const existingIdx = seen.get(key);
      if (classified.confidence > out[existingIdx].confidence) {
        out[existingIdx] = classified;
      }
      continue;
    }
    seen.set(key, out.length);
    out.push(classified);
  }
  return out;
}
