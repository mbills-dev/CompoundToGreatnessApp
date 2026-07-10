import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Dimension {
  category: string;
  label: string;
  vague: string;
  specific: string;
  icon: string;
  originalInput?: string;
}

interface AnalysisResult {
  dimensions: Dimension[];
}

interface RefineSuggestion {
  identity: string;
  quickSelects?: { label: string; value: string }[];
  customPrompt: string;
  qualifierExamples: string[];
}

interface TaskSuggestion {
  name: string;
  timeEstimate: string;
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SPELL_MAP: Record<string, string> = {
  moneuy: "money", moneu: "money", moeny: "money", mnoney: "money", monye: "money",
  mone: "money", momey: "money", monney: "money", monay: "money",
  excersize: "exercise", excercise: "exercise", exersice: "exercise", exersize: "exercise",
  excersize: "exercise", exercize: "exercise",
  wieght: "weight", weigth: "weight", wieght: "weight", wiehgt: "weight",
  helth: "health", heatlh: "health", heallth: "health",
  busines: "business", bussiness: "business", buisness: "business", buisiness: "business",
  carrer: "career", carreer: "career", carier: "career",
  freind: "friend", frend: "friend", friened: "friend",
  familly: "family", famly: "family", familey: "family",
  muscal: "muscle", muscel: "muscle", mussle: "muscle",
  runing: "running", runnin: "running",
  writting: "writing", writng: "writing",
  meditaion: "meditation", mediation: "meditation", mediatation: "meditation",
  graditude: "gratitude", greatitude: "gratitude", grattitude: "gratitude",
  disipline: "discipline", disipline: "discipline", dicipline: "discipline",
  productive: "productive", producive: "productive",
  laguage: "language", langauge: "language", languag: "language",
  finacial: "financial", finantial: "financial", finanical: "financial",
  relashionship: "relationship", reltionship: "relationship", relationhip: "relationship",
  spirtual: "spiritual", spirituel: "spiritual",
  habbit: "habit", habis: "habits",
  nutrtion: "nutrition", nutrtion: "nutrition", nutritoin: "nutrition",
  flexibilty: "flexibility", flexibiliy: "flexibility",
  confidance: "confidence", confidnce: "confidence",
  happines: "happiness", happyness: "happiness",
  develp: "develop", devlop: "develop",
  succesful: "successful", successfull: "successful", sucsessful: "successful",
  atheltie: "athletic", atheltic: "athletic", atheletic: "athletic",
  strenght: "strength", stregnth: "strength",
  busienss: "business", busness: "business",
  investement: "investment", invesment: "investment",
  saveing: "saving", savngs: "savings",
};

function correctSpelling(input: string): string {
  return input
    .split(/\b/)
    .map((token) => {
      const lower = token.toLowerCase();
      return SPELL_MAP[lower] !== undefined
        ? token[0] === token[0].toUpperCase() && token.length > 1
          ? SPELL_MAP[lower].charAt(0).toUpperCase() + SPELL_MAP[lower].slice(1)
          : SPELL_MAP[lower]
        : token;
    })
    .join("");
}

function splitIntoSubGoals(input: string): string[] {
  const cleaned = input.replace(/\.\s*$/, "").trim();
  const parts = cleaned
    .split(/,\s*/)
    .map((p) => p.replace(/^and\s+/i, "").trim())
    .filter((p) => p.length > 0);
  return parts.length > 0 ? parts : [cleaned];
}

const CATEGORY_KEYWORDS: {
  key: string;
  keywords: string[];
}[] = [
  {
    key: "professional",
    keywords: [
      "money", "earn", "income", "revenue", "salary", "business", "wealth",
      "rich", "financial", "profit", "side hustle", "freelanc", "promot",
      "career", "job", "clients", "sales", "brand",
    ],
  },
  {
    key: "fitness",
    keywords: [
      "shape", "weight", "muscle", "gym", "fit", "lean", "body", "abs",
      "strong", "athletic", "physique", "tone", "bulk", "shred", "exercise",
      "workout", "run", "lift", "cartwheel", "pushup", "pullup", "squat",
      "bench", "deadlift", "flexibility", "stretch", "yoga", "martial",
      "swim", "sprint", "endurance", "agile", "agility", "sport",
      "flexible", "flip", "handstand", "split",
    ],
  },
  {
    key: "health",
    keywords: [
      "health", "diet", "sleep", "energy", "wellness", "nutrition", "stress",
      "mental", "meditat", "mindful", "wake", "morning", "routine",
      "discipline", "habit", "productive", "focus",
    ],
  },
  {
    key: "relationships",
    keywords: [
      "dad", "father", "mom", "mother", "husband", "wife", "partner",
      "family", "friend", "relationship", "son", "daughter", "kids", "child",
      "parent", "marriage", "dating",
    ],
  },
  {
    key: "faith",
    keywords: [
      "faith", "pray", "god", "spiritual", "church", "bible", "purpose",
      "intention", "grateful", "gratitude", "serve", "meaning", "soul",
      "worship",
    ],
  },
  {
    key: "personal",
    keywords: [
      "learn", "read", "study", "skill", "language", "instrument", "cook",
      "write", "paint", "draw", "create", "build", "code", "program",
      "travel", "hobby", "craft", "master", "practice", "improve",
    ],
  },
];

function matchesKeyword(text: string, keyword: string): boolean {
  const regex = new RegExp(`(?:^|\\s|[^a-z])${keyword}`, "i");
  return regex.test(text);
}

function classifySubGoal(text: string): string | null {
  const lower = text.toLowerCase();
  for (const cat of CATEGORY_KEYWORDS) {
    if (cat.keywords.some((k) => matchesKeyword(lower, k))) {
      return cat.key;
    }
  }
  return null;
}

function normalizeIdentityStatement(raw: string): string {
  let s = raw.trim();
  if (s.endsWith(".")) s = s.slice(0, -1).trim();

  if (!/^I\s/i.test(s)) {
    const infinitiveMatch = s.match(/^(be|become|feel|get|stay|remain|have|know|speak|learn)\s+/i);
    if (infinitiveMatch) {
      const verb = infinitiveMatch[1].toLowerCase();
      const rest = s.slice(infinitiveMatch[0].length);
      s = verb === "have" ? `I have ${rest}` : `I am ${rest}`;
    } else {
      s = "I " + s;
    }
  }

  if (s.startsWith("i ")) s = "I" + s.slice(1);
  s = s.replace(/^I\s+am\s+someone\s+who\s+can\s+/i, "I ");
  s = s.replace(/^I\s+am\s+someone\s+who\s+/i, "I ");
  s = s.replace(/^I\s+be\s+/i, "I am ");
  s = s.replace(/^I\s+become\s+/i, "I am ");
  s = s.replace(/^I\s+'d\s+be\s+/i, "I am ");
  s = s.replace(/^I\s+would\s+be\s+/i, "I am ");
  s = s.replace(/^I\s+feel\s+(more|less|very|fully|truly|deeply|completely|highly|totally)\s+/i, (_m, adv) => `I am ${adv} `);
  const thirdPerson = /^I\s+(makes|takes|gives|shows|prioritizes|supports|helps|builds|lives|leads|earns|grows|runs|works|creates|brings|keeps|maintains|feels|loves|cares)\s+/i;
  s = s.replace(thirdPerson, (_m: string, verb: string) => "I " + verb.replace(/s$/i, "") + " ");
  return s;
}

function buildDimension(category: string, vagueText: string): Dimension {
  const lower = vagueText.toLowerCase();
  switch (category) {
    case "professional": {
      let vague = "make more money";
      if (lower.includes("business")) vague = "build my business";
      else if (lower.includes("brand") || lower.includes("content"))
        vague = "grow my brand";
      else if (lower.includes("promot") || lower.includes("career"))
        vague = "advance my career";
      else if (lower.includes("freelanc") || lower.includes("client"))
        vague = "grow my freelance business";
      return {
        category: "professional",
        label: "Professional / Finances",
        vague,
        specific: "I earn $10,000/month with ease",
        icon: "Briefcase",
      };
    }
    case "fitness": {
      let vague = vagueText.trim() || "get in shape";
      if (lower.includes("muscle") || lower.includes("bulk"))
        vague = "build muscle";
      else if (lower.includes("weight") || lower.includes("lean"))
        vague = "lose weight and get lean";
      else if (lower.includes("strong")) vague = "get stronger";
      return {
        category: "fitness",
        label: "Fitness / Health",
        vague,
        specific: "I weigh 180 pounds with visible muscle definition",
        icon: "Dumbbell",
      };
    }
    case "health": {
      let vague = vagueText.trim() || "be healthier";
      if (lower.includes("energy")) vague = "have more energy";
      else if (lower.includes("sleep")) vague = "sleep better";
      else if (lower.includes("discipline") || lower.includes("habit"))
        vague = "build better habits";
      else if (lower.includes("morning") || lower.includes("wake"))
        vague = "own my mornings";
      else if (lower.includes("diet") || lower.includes("nutrition") || lower.includes("eat"))
        vague = "eat healthier";
      else if (lower.includes("stress") || lower.includes("mental"))
        vague = "improve my mental health";
      return {
        category: "health",
        label: "Health / Wellness",
        vague,
        specific: "I take care of my body and mind every single day",
        icon: "Zap",
      };
    }
    case "relationships": {
      let vague = "be a better family person";

      const supportingMatch = lower.match(/(?:support|help|be there for|show up for|care for|love)\s+(?:my\s+)(husband|wife|dad|father|mom|mother|son|daughter|kids|children|partner)/i);
      const possessiveMatch = lower.match(/my\s+(husband|wife|dad|father|mom|mother|son|daughter|kids|children)/i);
      const inferredOpposite = (() => {
        const target = (supportingMatch?.[1] || possessiveMatch?.[1] || "").toLowerCase();
        if (target === "husband") return "wife";
        if (target === "wife") return "husband";
        if (target === "dad" || target === "father") return "child";
        if (target === "mom" || target === "mother") return "child";
        if (target === "son" || target === "daughter" || target === "kids" || target === "children") return "parent";
        return null;
      })();

      const roleMatch = lower.match(/(?:be(?:come)?|be a better|i(?:'m| am| want to be))\s+(?:a\s+)?(?:better\s+)?(dad|father|mom|mother|husband|wife|partner|friend)/i);
      const detectedRole = roleMatch ? roleMatch[1].toLowerCase() : null;

      if (inferredOpposite === "wife") vague = "be a better wife";
      else if (inferredOpposite === "husband") vague = "be a better husband";
      else if (inferredOpposite === "child") vague = "be a better son or daughter";
      else if (inferredOpposite === "parent") {
        if (lower.includes("son") || lower.includes("daughter") || lower.includes("kid") || lower.includes("child")) {
          vague = lower.includes("dad") || lower.includes("father") ? "be a better dad" : lower.includes("mom") || lower.includes("mother") ? "be a better mom" : "be a better parent";
        } else {
          vague = "be a better parent";
        }
      } else if (detectedRole === "dad" || detectedRole === "father" || (!detectedRole && (lower.includes("dad") || lower.includes("father"))))
        vague = "be a better dad";
      else if (detectedRole === "mom" || detectedRole === "mother" || (!detectedRole && (lower.includes("mom") || lower.includes("mother"))))
        vague = "be a better mom";
      else if (detectedRole === "wife" || (!detectedRole && lower.includes("wife")))
        vague = "be a better wife";
      else if (detectedRole === "husband" || (!detectedRole && lower.includes("husband")))
        vague = "be a better husband";
      else if (detectedRole === "partner" || (!detectedRole && lower.includes("partner")))
        vague = "be a better partner";
      else if (detectedRole === "friend" || (!detectedRole && lower.includes("friend")))
        vague = "be a better friend";

      const specificFromInput = normalizeIdentityStatement(vagueText);

      return {
        category: "relationships",
        label: "Relationships / Family",
        vague,
        specific: specificFromInput,
        icon: "Heart",
      };
    }
    case "faith":
      return {
        category: "faith",
        label: "Purpose / Faith",
        vague: "live with more purpose",
        specific: "I pray daily and live with intention",
        icon: "Star",
      };
    default: {
      const trimmed = vagueText.trim();
      const vagueDisplay = trimmed.length > 60 ? trimmed.substring(0, 60) + "..." : trimmed;
      const specific = normalizeIdentityStatement(trimmed);
      return {
        category: "personal",
        label: "Personal Growth",
        vague: vagueDisplay,
        specific: specific.length > 80 ? specific.substring(0, 80) : specific,
        icon: "Target",
      };
    }
  }
}

function parseGoalDimensions(input: string): Dimension[] {
  const subGoals = splitIntoSubGoals(input);
  const dimensions: Dimension[] = [];

  for (const sub of subGoals) {
    const category = classifySubGoal(sub) || "personal";
    const dim = buildDimension(category, sub);
    dim.originalInput = sub.trim();
    dimensions.push(dim);
  }

  if (dimensions.length === 0) {
    const dim = buildDimension("personal", input);
    dim.originalInput = input.trim();
    dimensions.push(dim);
  }

  return dimensions;
}

interface GoalPattern {
  keywords: string[];
  question: string;
  suggestions: string[];
  template: string;
}

const GOAL_PATTERNS: GoalPattern[] = [
  {
    keywords: ["french", "spanish", "german", "italian", "japanese", "chinese", "korean", "portuguese", "arabic", "russian", "hindi", "mandarin"],
    question: "What level of fluency are you aiming for?",
    suggestions: ["Conversational", "Fully fluent", "Read and write professionally"],
    template: "I am __ in {lang}",
  },
  {
    keywords: ["language"],
    question: "What level of fluency are you aiming for?",
    suggestions: ["Conversational", "Fully fluent", "Read and write professionally"],
    template: "I am __ in a new language",
  },
  {
    keywords: ["cartwheel"],
    question: "What kind of cartwheel would mean you've achieved this?",
    suggestions: ["One-handed cartwheel", "Running round-off", "No-hands aerial cartwheel"],
    template: "I can do a __ on command",
  },
  {
    keywords: ["flip", "backflip", "back flip"],
    question: "What kind of flip are you going for?",
    suggestions: ["Standing backflip", "Running front flip", "Standing back tuck"],
    template: "I can land a __ every time",
  },
  {
    keywords: ["handstand"],
    question: "What does mastering a handstand look like for you?",
    suggestions: ["60-second freestanding hold", "Walk across a room on my hands", "Press up from the ground without a wall"],
    template: "I can __",
  },
  {
    keywords: ["split", "splits"],
    question: "What level of splits are you aiming for?",
    suggestions: ["Full center split", "Left and right side splits", "Cold splits without warming up"],
    template: "I can do __",
  },
  {
    keywords: ["flexible", "flexibility", "stretch", "mobile", "mobility"],
    question: "What does being flexible look like for you?",
    suggestions: ["Touch my palms to the floor", "Full center splits", "Grab my foot behind my head"],
    template: "I can __ with ease",
  },
  {
    keywords: ["run", "marathon", "5k", "10k", "sprint"],
    question: "What running milestone are you targeting?",
    suggestions: ["Sub-20-minute 5K", "Full marathon under 4 hours", "6-minute mile"],
    template: "I can run a __",
  },
  {
    keywords: ["pushup", "push-up", "push up"],
    question: "What push-up milestone are you aiming for?",
    suggestions: ["100 in a row", "10 one-arm per side", "50 diamond push-ups"],
    template: "I can do __",
  },
  {
    keywords: ["pullup", "pull-up", "pull up", "chin up", "chinup"],
    question: "What pull-up milestone are you targeting?",
    suggestions: ["20 strict in a row", "5 muscle-ups", "A one-arm pull-up"],
    template: "I can do __",
  },
  {
    keywords: ["muscle", "bulk", "jacked", "big"],
    question: "What does your ideal muscular build look like?",
    suggestions: ["185 lbs with visible abs", "Bench 225 / Squat 315 / Deadlift 405", "200 lbs at 12% body fat"],
    template: "I have __",
  },
  {
    keywords: ["weight", "lean", "fat", "slim", "thin", "shred"],
    question: "What does your ideal body composition look like?",
    suggestions: ["170 lbs, lean and athletic", "165 lbs at 12% body fat", "155 lbs, toned and defined"],
    template: "I weigh __ with a lean build",
  },
  {
    keywords: ["strong", "strength", "lift", "squat", "bench", "deadlift"],
    question: "What strength milestone would prove you've made it?",
    suggestions: ["225 bench / 315 squat / 405 deadlift", "20 pull-ups and 30 dips", "Top 10% for my age and weight"],
    template: "I can __",
  },
  {
    keywords: ["yoga"],
    question: "What yoga milestone are you working toward?",
    suggestions: ["Crow pose for 30 seconds", "Full wheel pose", "2-minute headstand"],
    template: "I can hold a __ with control",
  },
  {
    keywords: ["martial", "fight", "box", "kick", "mma", "karate", "jiu"],
    question: "What martial arts milestone are you working toward?",
    suggestions: ["Earn my black belt", "Spar 5 rounds confidently", "Compete in an amateur fight"],
    template: "I can __",
  },
  {
    keywords: ["money", "earn", "income", "revenue", "salary", "wealth", "rich", "financial"],
    question: "How much do you want to earn per month?",
    suggestions: ["$5,000/month", "$10,000/month", "$25,000/month"],
    template: "I earn __ consistently",
  },
  {
    keywords: ["business", "startup", "entrepreneur", "company"],
    question: "What does a thriving business look like for you?",
    suggestions: ["$50K/month in revenue", "Team of 10, runs without me", "1,000+ paying customers"],
    template: "I run a business with __",
  },
  {
    keywords: ["brand", "content", "influenc", "social media", "youtube", "podcast"],
    question: "What does a successful personal brand look like?",
    suggestions: ["100K engaged followers", "10K+ views per post", "Sponsorship deals in my niche"],
    template: "I have __",
  },
  {
    keywords: ["career", "promot", "job", "role"],
    question: "What does career success look like for you?",
    suggestions: ["Senior leadership role", "$200K+ salary", "Go-to expert in my field"],
    template: "I have achieved __",
  },
  {
    keywords: ["freelanc", "client", "consult"],
    question: "What does a thriving freelance career look like?",
    suggestions: ["5+ recurring clients at $5K+ each", "3-month waitlist", "$15K/month on my own terms"],
    template: "I earn __",
  },
  {
    keywords: ["dad", "father"],
    question: "What does being an amazing dad look like for you?",
    suggestions: ["am fully present every evening, phone-free", "plan weekly one-on-one dates with each kid", "never miss a game or recital"],
    template: "I __",
  },
  {
    keywords: ["husband"],
    question: "What does being a great husband look like for you?",
    suggestions: ["plan a weekly date night, no excuses", "speak daily words of affirmation", "lead with patience and love"],
    template: "I __",
  },
  {
    keywords: ["mom", "mother"],
    question: "What does being an amazing mom look like for you?",
    suggestions: ["am fully present, creating memories daily", "balance my goals and family with grace", "model strength and kindness every day"],
    template: "I __",
  },
  {
    keywords: ["wife"],
    question: "What does being a great wife look like for you?",
    suggestions: ["show daily acts of love and intention", "prioritize open communication and quality time", "support my partner while growing myself"],
    template: "I __",
  },
  {
    keywords: ["partner", "relationship", "dating"],
    question: "What does your ideal relationship look like?",
    suggestions: ["am present and communicative every day", "make quality time a priority", "show up with consistent love and intention"],
    template: "I __",
  },
  {
    keywords: ["friend"],
    question: "What does being a great friend look like?",
    suggestions: ["reaches out daily and shows up", "is the one everyone calls first", "invests real time in friendships weekly"],
    template: "I am a friend who __",
  },
  {
    keywords: ["pray", "god", "church", "bible", "worship", "faith"],
    question: "What does a deep faith life look like for you?",
    suggestions: ["20 minutes of prayer every morning", "Weekly church and community service", "Lead my family in faith daily"],
    template: "I __",
  },
  {
    keywords: ["gratitude", "grateful", "thankful"],
    question: "How do you want to practice gratitude?",
    suggestions: ["Write 3 things every morning", "Start and end each day with reflection", "Express appreciation to someone daily"],
    template: "I __",
  },
  {
    keywords: ["meditat", "mindful"],
    question: "What does your meditation practice look like?",
    suggestions: ["20 minutes every morning", "Mindful throughout my entire day", "15-minute guided session before work"],
    template: "I meditate __",
  },
  {
    keywords: ["sleep", "wake", "morning", "routine"],
    question: "What does your ideal morning look like?",
    suggestions: ["Up at 5am, exercise + journal", "8 hours of sleep, wake refreshed", "Locked-in routine that sets up my day"],
    template: "I __",
  },
  {
    keywords: ["healthier", "healthy", "health"],
    question: "What aspect of your health do you want to improve?",
    suggestions: ["Sleep 8 hours and wake up energized", "Eat clean and fuel my body right", "Feel strong, rested, and full of energy"],
    template: "I __",
  },
  {
    keywords: ["energy", "wellness"],
    question: "What does peak energy look like for you?",
    suggestions: ["Boundless energy 5am to 10pm", "Clean fuel, feel amazing all day", "Sleep deeply, eat clean, energy to spare"],
    template: "I have __",
  },
  {
    keywords: ["discipline", "habit", "productive", "focus"],
    question: "What does peak discipline look like for you?",
    suggestions: ["Top 3 priorities done before noon", "Follow my schedule with zero excuses", "Laser focus, no distractions"],
    template: "I __",
  },
  {
    keywords: ["read", "book"],
    question: "What does your reading habit look like?",
    suggestions: ["30 pages every day", "1 hour before checking my phone", "2 books per month minimum"],
    template: "I read __",
  },
  {
    keywords: ["learn", "study", "skill"],
    question: "What does mastering this look like for you?",
    suggestions: ["1 hour of practice every day", "Advanced level, can teach others", "Top 10% in my community"],
    template: "I __ consistently",
  },
  {
    keywords: ["cook", "chef", "meal"],
    question: "What does being a great cook look like?",
    suggestions: ["20 recipes from memory", "Meal-prep the whole week on Sunday", "Make a great meal from anything"],
    template: "I can __",
  },
  {
    keywords: ["write", "author", "blog", "journal"],
    question: "What does your writing practice look like?",
    suggestions: ["1,000 words every day", "Journal every morning", "Publish weekly articles"],
    template: "I __",
  },
  {
    keywords: ["code", "program", "develop", "software", "app"],
    question: "What does your coding goal look like?",
    suggestions: ["Build and ship a full-stack app solo", "Code 2 hours daily", "Senior-level problem solver"],
    template: "I can __",
  },
  {
    keywords: ["travel"],
    question: "What does your travel goal look like?",
    suggestions: ["4 new countries per year", "Freedom to travel whenever I want", "3 months per year abroad"],
    template: "I __",
  },
  {
    keywords: ["paint", "draw", "art", "creat"],
    question: "What does your creative practice look like?",
    suggestions: ["Create art every day", "50+ piece portfolio", "1 hour daily on my craft"],
    template: "I __",
  },
  {
    keywords: ["instrument", "music", "guitar", "piano", "drum", "sing"],
    question: "What does musical mastery look like for you?",
    suggestions: ["20 songs from memory", "30 minutes daily practice", "Record my own music"],
    template: "I can __",
  },
  {
    keywords: ["swim"],
    question: "What swimming milestone are you aiming for?",
    suggestions: ["Swim a mile nonstop", "Complete a triathlon", "Confident in open water"],
    template: "I can __",
  },
  {
    keywords: ["diet", "nutrition", "eat", "food"],
    question: "What does your ideal nutrition look like?",
    suggestions: ["Clean foods 90% of the time", "Hit my protein target daily", "Simple diet that fuels performance"],
    template: "I eat __",
  },
  {
    keywords: ["adventure", "explore", "outdoor", "outdoors", "hiking", "hike", "camping", "camp"],
    question: "What does going on adventures mean for you?",
    suggestions: ["Take 1 big trip per quarter", "Explore a new place every weekend", "Summit a new peak every season"],
    template: "I __",
  },
  {
    keywords: ["confident", "confidence"],
    question: "What does confidence look like for you?",
    suggestions: ["Speak up in any room without hesitation", "Walk into any situation calm and assured", "Stop seeking approval and own my decisions"],
    template: "I __",
  },
  {
    keywords: ["happy", "happiness", "joy", "joyful", "enjoy"],
    question: "What does happiness look like in your daily life?",
    suggestions: ["Wake up genuinely excited every morning", "Create daily moments I look forward to", "Feel fulfilled in my work and relationships"],
    template: "I __",
  },
  {
    keywords: ["stress", "anxiety", "calm", "peace", "peaceful"],
    question: "What does living without stress look like?",
    suggestions: ["Stay calm under any pressure", "Leave work at work and be fully present", "Process setbacks without spiraling"],
    template: "I __",
  },
  {
    keywords: ["network", "connect", "social", "people"],
    question: "What does building connections look like for you?",
    suggestions: ["Meet 2 new people in my field per week", "A tight network of 50 high-quality people", "Become the connector everyone calls on"],
    template: "I __",
  },
  {
    keywords: ["sport", "athlete", "game", "team", "play"],
    question: "What does excelling at your sport look like?",
    suggestions: ["Starting lineup on my team", "Compete at the next level", "Best athlete in my age group"],
    template: "I am a __ athlete",
  },
  {
    keywords: ["save", "invest", "wealth"],
    question: "What does financial security look like for you?",
    suggestions: ["6-month emergency fund, fully funded", "$1M invested by 40", "Debt-free with $500K in assets"],
    template: "I have __",
  },
  {
    keywords: ["photo", "photograph", "video", "film", "cinema"],
    question: "What does mastering this craft look like?",
    suggestions: ["Get paid for my work regularly", "Build a portfolio of 100 great shots", "Shoot and edit a short film"],
    template: "I __",
  },
  {
    keywords: ["dance", "dancing"],
    question: "What does your dance goal look like?",
    suggestions: ["Perform in front of a crowd", "Know 5 styles fluently", "Freestyle with full confidence"],
    template: "I can __",
  },
  {
    keywords: ["speak", "public speaking", "presentation", "speech"],
    question: "What does commanding a room look like for you?",
    suggestions: ["Give a TEDx talk", "Lead presentations of 100+ people", "Never feel nervous at a microphone"],
    template: "I can __",
  },
];

function detectLanguage(text: string): string | null {
  const langs: Record<string, string> = {
    french: "French", spanish: "Spanish", german: "German", italian: "Italian",
    japanese: "Japanese", chinese: "Chinese", korean: "Korean", portuguese: "Portuguese",
    arabic: "Arabic", russian: "Russian", hindi: "Hindi", mandarin: "Mandarin",
  };
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(langs)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

function buildIdentityFromTemplate(template: string, value: string, vague: string): string {
  const lang = detectLanguage(vague);

  let insertValue = value;
  if (template === "I __") {
    insertValue = value.replace(/^(my|the)\s+/i, "").trim();
    if (insertValue.length > 0) {
      insertValue = insertValue.charAt(0).toLowerCase() + insertValue.slice(1);
    }
  } else {
    insertValue = value.toLowerCase();
  }

  if (/^\$/.test(insertValue)) {
    insertValue = value;
  }

  if (/^I am\s/i.test(template)) {
    insertValue = insertValue.replace(/^(be|am|being)\s+/i, "").trim();
  }
  if (/^I am (a|an)\s/i.test(template)) {
    insertValue = insertValue.replace(/^(a|an)\s+/i, "").trim();
  }
  if (/who\s+__/.test(template)) {
    insertValue = insertValue.replace(/^(who|that)\s+/i, "").trim();
  }
  if (/^I\s+(can|do|have|earn|eat)\s/i.test(template)) {
    const match = template.match(/^I\s+(can|do|have|earn|eat)\s/i);
    if (match) {
      const verb = match[1].toLowerCase();
      const re = new RegExp("^" + verb + "\\s+", "i");
      insertValue = insertValue.replace(re, "").trim();
    }
  }

  let result = template.replace("__", insertValue);
  if (lang) result = result.replace("{lang}", lang);
  if (!result.startsWith("I ")) result = "I " + result;
  return result;
}

function isAlreadySpecific(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (/\$[\d,.]+/.test(lower)) return true;
  if (/\d+k\b/.test(lower)) return true;
  if (/\d+\s*(lbs?|pounds?|kg|miles?|minutes?|hours?|days?|times?|reps?|sets?)\b/.test(lower)) return true;
  if (/\d+\/month/.test(lower)) return true;
  if (/\d+\s*(a|per)\s*(month|week|day|year)\b/.test(lower)) return true;
  if (/\d+%/.test(lower)) return true;
  if (/\d{2,}/.test(lower) && lower.split(/\s+/).length >= 2) return true;
  return false;
}

function buildSpecificSuggestions(dimension: Dimension): {
  question: string;
  suggestions: string[];
  template: string;
  identity: string;
  alreadySpecific: boolean;
} {
  const input = dimension.originalInput || dimension.vague;
  const lower = input.toLowerCase();

  const moneyMatch = lower.match(/\$?([\d,.]+)\s*k?\s*(\/|\s*a\s*|\s*per\s*)?(month|mo|week|wk|year|yr)?/i);
  if (moneyMatch || /money|earn|income|revenue/.test(lower)) {
    return {
      question: `You said "${input}" — how do you want to frame this as your identity?`,
      suggestions: [
        `I earn ${input} consistently and predictably`,
        `I earn ${input} through work I'm proud of`,
        `I earn ${input} while maintaining full balance in my life`,
      ],
      template: "I __",
      identity: dimension.specific,
      alreadySpecific: true,
    };
  }

  if (/lbs?|pounds?|kg|weight/.test(lower)) {
    return {
      question: `You said "${input}" — how do you want to frame this?`,
      suggestions: [
        `I weigh ${input.replace(/^(weigh|get to|hit|reach)\s*/i, "")} with a lean, athletic build`,
        `I maintain ${input.replace(/^(weigh|get to|hit|reach)\s*/i, "")} with visible definition`,
        `I am at ${input.replace(/^(weigh|get to|hit|reach)\s*/i, "")} and feel incredible`,
      ],
      template: "I __",
      identity: dimension.specific,
      alreadySpecific: true,
    };
  }

  return {
    question: `You said "${input}" — how do you want to frame this as your identity?`,
    suggestions: [
      `I ${input.charAt(0).toLowerCase() + input.slice(1)} consistently, no excuses`,
      `I ${input.charAt(0).toLowerCase() + input.slice(1)} and it's non-negotiable`,
      `I ${input.charAt(0).toLowerCase() + input.slice(1)} because that's who I am`,
    ],
    template: "I __",
    identity: dimension.specific,
    alreadySpecific: true,
  };
}

function getRefineSuggestions(dimension: Dimension): {
  question: string;
  suggestions: string[];
  template: string;
  identity: string;
  alreadySpecific?: boolean;
} {
  const originalInput = dimension.originalInput || "";
  if (originalInput && isAlreadySpecific(originalInput)) {
    return buildSpecificSuggestions(dimension);
  }

  const lower = dimension.vague.toLowerCase();

  for (const pattern of GOAL_PATTERNS) {
    if (pattern.keywords.some((k) => lower.includes(k))) {
      return {
        question: pattern.question,
        suggestions: pattern.suggestions,
        template: pattern.template,
        identity: dimension.specific,
      };
    }
  }

  if (dimension.originalInput) {
    const lowerOriginal = dimension.originalInput.toLowerCase();
    for (const pattern of GOAL_PATTERNS) {
      if (pattern.keywords.some((k) => lowerOriginal.includes(k))) {
        return {
          question: pattern.question,
          suggestions: pattern.suggestions,
          template: pattern.template,
          identity: dimension.specific,
        };
      }
    }
  }

  switch (dimension.category) {
    case "professional":
      return {
        question: "What does achieving this look like for you?",
        suggestions: ["$10,000/month", "$25,000/month", "$50,000/month"],
        template: "I earn __ consistently",
        identity: dimension.specific,
      };
    case "fitness":
      return {
        question: "What does your ideal fitness look like?",
        suggestions: ["am lean and athletic at 175 lbs", "can run a 5K and do 50 push-ups", "train 5 days a week, stronger than ever"],
        template: "I __",
        identity: dimension.specific,
      };
    case "relationships":
      return {
        question: "What does showing up for the people you love look like?",
        suggestions: ["is fully present every evening", "never misses what matters", "leads with patience and love"],
        template: "I am someone who __",
        identity: dimension.specific,
      };
    case "faith":
      return {
        question: "What does living with purpose look like for you?",
        suggestions: ["Pray daily, live with intention", "Start each day with gratitude", "Serve my community with purpose"],
        template: "I __",
        identity: dimension.specific,
      };
    case "lifestyle":
      return {
        question: "What does your ideal daily routine look like?",
        suggestions: ["Up at 5am, own my mornings", "Boundless energy all day", "Laser focus on my priorities"],
        template: "I __",
        identity: dimension.specific,
      };
    default:
      return buildSmartFallback(dimension);
  }
}

function buildSmartFallback(dimension: Dimension): {
  question: string;
  suggestions: string[];
  template: string;
  identity: string;
} {
  const v = dimension.vague.toLowerCase().trim();

  const isAction = /^(be |become |get |feel |have |make |build |create |start |stop |quit |lose |gain |improve |develop |grow |learn |master |achieve |reach |live |find |spend |give |take |do |go |run |walk |work |eat |drink |sleep |read |write |speak |think |love |help |serve |lead |manage |own |buy |sell |move |stay |focus |practice |train |compete |travel |explore |connect |network|try )/.test(v);

  if (/\bgo on\b/.test(v) || /\bexplore\b/.test(v) || /\badventur/.test(v)) {
    return {
      question: "What does going on adventures mean for you?",
      suggestions: ["Take 1 big trip every quarter", "Explore a new place every single weekend", "Summit a new trail or peak each season"],
      template: "I __",
      identity: dimension.specific,
    };
  }

  if (/\bbe (a|an|the)\b/.test(v) || /\bbecome (a|an|the)\b/.test(v)) {
    const role = v.replace(/^(be|become)\s+(a|an|the)\s+/i, "").trim();
    return {
      question: `What does being a ${role} look like for you?`,
      suggestions: [`Known as the go-to ${role} in my field`, `Recognized and respected as a ${role}`, `Living fully as a ${role} day-to-day`],
      template: "I am a __ who delivers results",
      identity: dimension.specific,
    };
  }

  if (/\bfeel\b/.test(v)) {
    const feeling = v.replace(/^(feel|feeling)\s+/i, "").trim();
    return {
      question: `What does feeling ${feeling} look like every day?`,
      suggestions: [`Wake up ${feeling} without effort`, `Consistently ${feeling} no matter the circumstances`, `Build a life that naturally creates feeling ${feeling}`],
      template: "I __",
      identity: dimension.specific,
    };
  }

  if (/\bget (better|good|great|stronger|faster|fitter|healthier|smarter|richer)\b/.test(v)) {
    const quality = v.replace(/^get\s+/i, "").trim();
    return {
      question: `What does being ${quality} look like specifically?`,
      suggestions: [`Measurably ${quality} by a specific benchmark`, `${quality.charAt(0).toUpperCase() + quality.slice(1)} enough to notice a clear difference`, `The ${quality} version of me shows up every single day`],
      template: "I am __",
      identity: dimension.specific,
    };
  }

  if (/\b(stop|quit)\b/.test(v)) {
    const habit = v.replace(/^(stop|quit)\s+/i, "").trim();
    return {
      question: `What does life look like once you've stopped ${habit}?`,
      suggestions: [`Free from ${habit} for good — no relapses`, `${habit.charAt(0).toUpperCase() + habit.slice(1)} is no longer part of my life`, `Replaced ${habit} with a healthy habit I'm proud of`],
      template: "I have __",
      identity: dimension.specific,
    };
  }

  if (/\b(build|create|make|start|launch|ship)\b/.test(v)) {
    const thing = v.replace(/^(build|create|make|start|launch|ship)\s+/i, "").trim();
    return {
      question: `What does successfully building ${thing || "this"} look like?`,
      suggestions: [
        thing ? `${thing.charAt(0).toUpperCase() + thing.slice(1)} is live and generating real results` : "It's live, generating real results",
        thing ? `${thing.charAt(0).toUpperCase() + thing.slice(1)} is something I'm proud to share` : "Something I'm proud to share with the world",
        "The foundation is done and I'm scaling it",
      ],
      template: "I have built __",
      identity: dimension.specific,
    };
  }

  if (/\b(lose|drop)\b.*\b(weight|lbs|pounds|kg)\b/.test(v)) {
    return {
      question: "What does your ideal body look like?",
      suggestions: ["20 lbs lighter, lean and athletic", "Fit in clothes I haven't worn in years", "Visible muscle tone and high energy all day"],
      template: "I __",
      identity: dimension.specific,
    };
  }

  if (isAction) {
    const verb = v.split(" ")[0];
    const rest = v.slice(verb.length).trim();
    return {
      question: `What does it look like when you truly ${v}?`,
      suggestions: [
        rest ? `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${rest} consistently and with pride` : `${verb.charAt(0).toUpperCase() + verb.slice(1)} consistently and with pride`,
        `${verb.charAt(0).toUpperCase() + verb.slice(1)}${rest ? " " + rest : ""} at a level that impresses even me`,
        `${verb.charAt(0).toUpperCase() + verb.slice(1)}${rest ? " " + rest : ""} without struggle — it's who I am`,
      ],
      template: "I __",
      identity: dimension.specific,
    };
  }

  return {
    question: `What does "${dimension.vague}" look like when you've fully achieved it?`,
    suggestions: [
      `${dimension.vague} — measurable, consistent, and real`,
      `${dimension.vague} in a way I'm genuinely proud of`,
      `${dimension.vague} has become a natural part of who I am`,
    ],
    template: "I __",
    identity: dimension.specific,
  };
}

function generateTasksForDimension(dimension: Dimension): TaskSuggestion[] {
  switch (dimension.category) {
    case "professional":
      return [
        { name: "Complete 2 hours of deep revenue-generating work", timeEstimate: "120 min" },
        { name: "Reach out to 5 potential clients or leads", timeEstimate: "30 min" },
        { name: "Create 1 piece of valuable content", timeEstimate: "45 min" },
      ];
    case "fitness":
      return [
        { name: "Complete strength training session", timeEstimate: "45 min" },
        { name: "Hit daily protein target", timeEstimate: "5 min to track" },
        { name: "Do 20 minutes of cardio or active recovery", timeEstimate: "20 min" },
      ];
    case "relationships":
      return [
        { name: "Spend 30 minutes of quality phone-free time with family", timeEstimate: "30 min" },
        { name: "Do one intentional act of service for a loved one", timeEstimate: "15 min" },
      ];
    case "faith":
      return [
        { name: "Pray or meditate for 15 minutes", timeEstimate: "15 min" },
        { name: "Read 10 pages of a faith or purpose-driven book", timeEstimate: "20 min" },
      ];
    case "lifestyle":
      return [
        { name: "Wake up at 5am and complete your morning routine", timeEstimate: "60 min" },
        { name: "Get 8 hours of sleep (lights out by 9pm)", timeEstimate: "8 hours" },
      ];
    default:
      return [
        { name: "Work on your primary goal for 1 focused hour", timeEstimate: "60 min" },
        { name: "Reflect on progress and journal for 10 minutes", timeEstimate: "10 min" },
      ];
  }
}

function buildCompassFilterQuestion(declaration: string, vision: string): string {
  let text = declaration.trim();

  text = text.replace(/^(by\s+|through\s+|via\s+)/i, "");
  text = text.replace(/[.!?]+$/, "").trim();

  const lower = text.toLowerCase();

  const andParts = text.split(/,?\s+and\s+/i).map(p => p.trim()).filter(Boolean);
  const commaParts = text.split(/,\s*/).map(p => p.trim()).filter(Boolean);

  function toVerb(phrase: string): string {
    const p = phrase.trim();
    const gerundMatch = p.match(/^(\w+ing)\b(.*)$/i);
    if (gerundMatch) {
      const base = gerundMatch[1].toLowerCase().replace(/ing$/, "");
      const rest = gerundMatch[2].trim();
      const irregulars: Record<string, string> = {
        mak: "make", tak: "take", giv: "give", writ: "write", driv: "drive",
        liv: "live", hav: "have", manag: "manage", creat: "create", mov: "move",
        clos: "close", bild: "build", typ: "type", sav: "save", hir: "hire",
        sell: "sell", tell: "tell", call: "call", pull: "pull", fill: "fill",
        fall: "fall", feel: "feel", kill: "kill", roll: "roll", will: "will",
        run: "run", get: "get", set: "set", put: "put", cut: "cut", sit: "sit",
        hit: "hit", let: "let", win: "win",
      };
      const noAppendE = base.endsWith("t") || base.endsWith("n") || base.endsWith("d") ||
        base.endsWith("l") || base.endsWith("r") || base.endsWith("s") || base.endsWith("k") ||
        base.endsWith("p") || base.endsWith("g") || base.endsWith("m");
      const stem = irregulars[base] || (noAppendE ? base : base + "e");
      return rest ? `${stem} ${rest}` : stem;
    }
    return p.charAt(0).toLowerCase() + p.slice(1);
  }

  if (andParts.length >= 2) {
    const verbs = andParts.map(toVerb);
    if (verbs.length === 2) {
      return `Will this help me ${verbs[0]} and ${verbs[1]}?`;
    }
    const last = verbs.pop()!;
    return `Will this help me ${verbs.join(", ")}, and ${last}?`;
  }

  if (commaParts.length >= 2) {
    const verbs = commaParts.map(toVerb);
    if (verbs.length === 2) {
      return `Will this help me ${verbs[0]} and ${verbs[1]}?`;
    }
    const last = verbs.pop()!;
    return `Will this help me ${verbs.join(", ")}, and ${last}?`;
  }

  const verb = toVerb(text);


  return `Will this help me ${verb}?`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split("/").pop();

    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405);
    }

    const body = await req.json();

    if (path === "analyze") {
      const { goalText } = body;
      if (!goalText || typeof goalText !== "string") {
        return errorResponse("goalText is required");
      }

      const corrected = correctSpelling(goalText.trim());
      const dimensions = parseGoalDimensions(corrected);

      const result: AnalysisResult = { dimensions };

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "refine") {
      const { dimension } = body;
      if (!dimension) {
        return errorResponse("dimension is required");
      }

      const suggestion = getRefineSuggestions(dimension);

      return new Response(JSON.stringify(suggestion), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "tasks") {
      const { dimensions } = body;
      if (!dimensions || !Array.isArray(dimensions)) {
        return errorResponse("dimensions array is required");
      }

      const allTasks: { dimension: string; tasks: TaskSuggestion[] }[] = [];

      for (const dim of dimensions) {
        allTasks.push({
          dimension: dim.label || dim.category,
          tasks: generateTasksForDimension(dim),
        });
      }

      return new Response(JSON.stringify({ taskGroups: allTasks }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (path === "compass-filter") {
      const { declaration, vision } = body;
      if (!declaration || typeof declaration !== "string") {
        return errorResponse("declaration is required");
      }

      const filterQuestion = buildCompassFilterQuestion(declaration.trim(), (vision || "").trim());

      return new Response(JSON.stringify({ filterQuestion }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return errorResponse("Unknown endpoint: " + path, 404);
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
