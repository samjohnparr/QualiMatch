// assets/bank_inline.js
// Non-module fallback for file:// use.
// assets/bank.js
const DESIGN_LABELS = {
  phenomenology: "Phenomenology",
  case_study: "Case Study",
  ethnography: "Ethnography",
  grounded_theory: "Grounded Theory",
  narrative_inquiry: "Narrative Inquiry",
};

const SOURCE_LABELS = {
  interview: "Interview",
  focus_group: "Focus Group Discussion (FGD)",
  observation: "Observation",
  document_analysis: "Document Analysis",
  artifact_analysis: "Artifact Analysis",
};

const PRETEST_ITEMS = [
  { id:"pre_01", topic:"Study stress among Grade 11 learners",
    rq:"How do Grade 11 learners describe their lived experience of study stress during Quarter 3?",
    correct_design_id:"phenomenology", correct_data_source_id:"interview",
    explanation:"Lived experience and meaning fit phenomenology. Interviews support depth and privacy.",
    distractor_design_ids:["case_study","ethnography","grounded_theory"],
    distractor_source_ids:["focus_group","observation","document_analysis"]
  },
  { id:"pre_02", topic:"Online learning challenges",
    rq:"What do learners say are the most challenging parts of online learning, and why do these challenges matter to them?",
    correct_design_id:"phenomenology", correct_data_source_id:"focus_group",
    explanation:"Perceptions/meaning fit phenomenology. FGD encourages shared reflection and contrasts.",
    distractor_design_ids:["case_study","grounded_theory","narrative_inquiry"],
    distractor_source_ids:["interview","observation","artifact_analysis"]
  },
  { id:"pre_03", topic:"Meaning of academic integrity",
    rq:"How do students interpret the idea of 'academic integrity' in their daily school work?",
    correct_design_id:"phenomenology", correct_data_source_id:"interview",
    explanation:"The question targets meaning and interpretation. Interviews allow probing and examples.",
    distractor_design_ids:["ethnography","case_study","grounded_theory"],
    distractor_source_ids:["focus_group","document_analysis","observation"]
  },
  { id:"pre_04", topic:"Culture of peer support in a section",
    rq:"What norms and unwritten rules shape peer support practices within Section EROS?",
    correct_design_id:"ethnography", correct_data_source_id:"observation",
    explanation:"Norms/unwritten rules point to group culture, fitting ethnography. Observation captures real routines.",
    distractor_design_ids:["case_study","phenomenology","narrative_inquiry"],
    distractor_source_ids:["interview","focus_group","artifact_analysis"]
  },
  { id:"pre_05", topic:"Choosing an SHS strand",
    rq:"How do students decide which SHS strand to take, and what steps do they usually go through?",
    correct_design_id:"grounded_theory", correct_data_source_id:"interview",
    explanation:"The focus is a decision process, fitting grounded theory. Interviews uncover stages and influences.",
    distractor_design_ids:["phenomenology","case_study","ethnography"],
    distractor_source_ids:["focus_group","document_analysis","observation"]
  },
  { id:"pre_06", topic:"Experiences of working students",
    rq:"How do working students describe balancing school demands and part-time work responsibilities?",
    correct_design_id:"phenomenology", correct_data_source_id:"interview",
    explanation:"Lived experience fits phenomenology. Interviews are suitable for sensitive, personal contexts.",
    distractor_design_ids:["case_study","ethnography","narrative_inquiry"],
    distractor_source_ids:["focus_group","artifact_analysis","observation"]
  },
  { id:"pre_07", topic:"A student leader’s journey",
    rq:"What is the story of a class officer’s journey from being elected to handling responsibilities over the school year?",
    correct_design_id:"narrative_inquiry", correct_data_source_id:"interview",
    explanation:"A coherent story over time fits narrative inquiry. Interviews support timelines and turning points.",
    distractor_design_ids:["phenomenology","case_study","grounded_theory"],
    distractor_source_ids:["document_analysis","focus_group","observation"]
  },
  { id:"pre_08", topic:"Effect of a school reading program",
    rq:"How did the school's reading program affect the reading habits of a small group of Grade 11 learners in one section?",
    correct_design_id:"case_study", correct_data_source_id:"document_analysis",
    explanation:"A bounded program in a defined group fits case study. Documents/logs provide verifiable evidence.",
    distractor_design_ids:["ethnography","phenomenology","narrative_inquiry"],
    distractor_source_ids:["interview","observation","artifact_analysis"]
  },
  { id:"pre_09", topic:"How habits form in a study group",
    rq:"How do study routines and habits develop within a small peer study group over the semester?",
    correct_design_id:"grounded_theory", correct_data_source_id:"observation",
    explanation:"Habit development suggests a process, fitting grounded theory. Observation captures repeated behaviors over time.",
    distractor_design_ids:["phenomenology","case_study","narrative_inquiry"],
    distractor_source_ids:["interview","document_analysis","artifact_analysis"]
  },
  { id:"pre_10", topic:"Shared norms in a club",
    rq:"What traditions and shared norms guide members’ behavior in the school journalism club?",
    correct_design_id:"ethnography", correct_data_source_id:"focus_group",
    explanation:"Traditions/norms are cultural patterns, fitting ethnography. FGD surfaces shared meanings and differences.",
    distractor_design_ids:["case_study","phenomenology","grounded_theory"],
    distractor_source_ids:["interview","document_analysis","artifact_analysis"]
  }
];

const POSTTEST_ITEMS = [
  { id:"post_01", topic:"School canteen experience",
    rq:"How do students describe their lived experience of buying food at the school canteen during busy break times?",
    correct_design_id:"phenomenology", correct_data_source_id:"interview",
    explanation:"Lived experience fits phenomenology. Interviews allow detailed perception and meaning.",
    distractor_design_ids:["ethnography","case_study","grounded_theory"],
    distractor_source_ids:["observation","focus_group","document_analysis"]
  },
  { id:"post_02", topic:"Culture of group chats",
    rq:"What norms and communication styles shape how students use their class group chat?",
    correct_design_id:"ethnography", correct_data_source_id:"observation",
    explanation:"Norms/styles point to culture, fitting ethnography. Observation captures actual patterns (with consent).",
    distractor_design_ids:["case_study","phenomenology","narrative_inquiry"],
    distractor_source_ids:["interview","focus_group","artifact_analysis"]
  },
  { id:"post_03", topic:"How students prepare for reporting",
    rq:"What process do students go through when preparing for an oral report in class?",
    correct_design_id:"grounded_theory", correct_data_source_id:"interview",
    explanation:"The question targets a process, fitting grounded theory. Interviews uncover stages and influences.",
    distractor_design_ids:["phenomenology","case_study","ethnography"],
    distractor_source_ids:["focus_group","observation","document_analysis"]
  },
  { id:"post_04", topic:"Journey of a transferee student",
    rq:"How does a transferee student narrate their adjustment journey from the first week to the end of the quarter?",
    correct_design_id:"narrative_inquiry", correct_data_source_id:"interview",
    explanation:"A journey story over time fits narrative inquiry. Interviews support a coherent narrative.",
    distractor_design_ids:["phenomenology","grounded_theory","case_study"],
    distractor_source_ids:["document_analysis","observation","focus_group"]
  },
  { id:"post_05", topic:"A classroom seating strategy",
    rq:"How did a new seating strategy affect participation patterns in one Grade 11 class over two weeks?",
    correct_design_id:"case_study", correct_data_source_id:"observation",
    explanation:"A bounded change in one class fits case study. Observation captures participation patterns directly.",
    distractor_design_ids:["ethnography","phenomenology","grounded_theory"],
    distractor_source_ids:["interview","document_analysis","artifact_analysis"]
  },
  { id:"post_06", topic:"Meaning of 'respect' in class",
    rq:"What does 'respect' mean to students in daily classroom interactions, and how do they recognize it?",
    correct_design_id:"phenomenology", correct_data_source_id:"focus_group",
    explanation:"Meaning-making fits phenomenology. FGD can surface shared definitions and examples.",
    distractor_design_ids:["ethnography","case_study","narrative_inquiry"],
    distractor_source_ids:["interview","observation","document_analysis"]
  },
  { id:"post_07", topic:"How learners manage procrastination",
    rq:"How do students describe the ways they manage procrastination, and how do these strategies develop over time?",
    correct_design_id:"grounded_theory", correct_data_source_id:"interview",
    explanation:"Strategy development suggests a process, fitting grounded theory. Interviews reveal stages and changes.",
    distractor_design_ids:["phenomenology","case_study","ethnography"],
    distractor_source_ids:["focus_group","observation","artifact_analysis"]
  },
  { id:"post_08", topic:"Club membership traditions",
    rq:"What traditions and shared meanings do members attach to joining rituals in a school club?",
    correct_design_id:"ethnography", correct_data_source_id:"focus_group",
    explanation:"Rituals/traditions are cultural practices, fitting ethnography. FGD clarifies shared meanings.",
    distractor_design_ids:["case_study","phenomenology","grounded_theory"],
    distractor_source_ids:["interview","observation","document_analysis"]
  },
  { id:"post_09", topic:"Impact of a weekly reflection journal",
    rq:"How did writing a weekly reflection journal affect the self-awareness of a small group of learners in one section?",
    correct_design_id:"case_study", correct_data_source_id:"artifact_analysis",
    explanation:"A bounded activity in a defined group fits case study. Artifact analysis examines journal patterns.",
    distractor_design_ids:["phenomenology","ethnography","narrative_inquiry"],
    distractor_source_ids:["interview","observation","document_analysis"]
  },
  { id:"post_10", topic:"Story of overcoming math anxiety",
    rq:"What is the story of a learner’s experience of math anxiety and how they gradually overcame it across the semester?",
    correct_design_id:"narrative_inquiry", correct_data_source_id:"interview",
    explanation:"A story of change over time fits narrative inquiry. Interviews support turning points and reflections.",
    distractor_design_ids:["phenomenology","case_study","grounded_theory"],
    distractor_source_ids:["focus_group","observation","artifact_analysis"]
  }
];

const PRACTICE_CARDS = [
  { id:"card_01", topic:"Study stress",
    rq:"How do learners experience and make sense of study stress during exam week?",
    correct_design_id:"phenomenology", correct_data_source_id:"interview",
    explanation:"Lived experience and meaning fit phenomenology. Interviews support depth and privacy.",
    teacher_note:"Prompt: Identify words signaling lived experience, and justify why interviews fit sensitive topics."
  },
  { id:"card_02", topic:"Class group chat culture",
    rq:"What norms guide how students communicate in the class group chat?",
    correct_design_id:"ethnography", correct_data_source_id:"observation",
    explanation:"Group norms/culture fit ethnography. Observation (with consent) captures interaction patterns.",
    teacher_note:"Prompt: What makes this about a group culture rather than one person’s experience?"
  },
  { id:"card_03", topic:"Strand choice process",
    rq:"How do students decide on an SHS strand, step by step?",
    correct_design_id:"grounded_theory", correct_data_source_id:"interview",
    explanation:"A decision pathway suggests a process, fitting grounded theory. Interviews reveal stages and influences.",
    teacher_note:"Prompt: Ask learners to list possible stages they expect from interview data."
  },
  { id:"card_04", topic:"Officer journey",
    rq:"What is the story of a class officer’s growth from the start of the school year to the end of Quarter 3?",
    correct_design_id:"narrative_inquiry", correct_data_source_id:"interview",
    explanation:"A coherent story over time fits narrative inquiry. Interviews support timelines and turning points.",
    teacher_note:"Prompt: What makes a ‘story’ different from describing feelings only?"
  },
  { id:"card_05", topic:"New seating plan in one class",
    rq:"How did the new seating plan influence participation in one Grade 11 class for two weeks?",
    correct_design_id:"case_study", correct_data_source_id:"observation",
    explanation:"A bounded classroom change fits case study. Observation captures participation behaviors.",
    teacher_note:"Prompt: Identify the bounded case (setting, time, participants)."
  },
  { id:"card_06", topic:"Meaning of 'respect'",
    rq:"What does 'respect' mean to students in everyday classroom interactions?",
    correct_design_id:"phenomenology", correct_data_source_id:"focus_group",
    explanation:"Meaning-making fits phenomenology. FGD can surface shared definitions and examples.",
    teacher_note:"Prompt: When is FGD better than interviews for meaning-making questions?"
  },
  { id:"card_07", topic:"Club traditions",
    rq:"What traditions and shared meanings shape the identity of members in a school club?",
    correct_design_id:"ethnography", correct_data_source_id:"focus_group",
    explanation:"Culture and shared meaning fit ethnography. FGD helps members negotiate shared traditions.",
    teacher_note:"Prompt: Ask students to underline words signaling culture and shared meaning."
  },
  { id:"card_08", topic:"Working student life",
    rq:"How do working students experience balancing school requirements and work responsibilities?",
    correct_design_id:"phenomenology", correct_data_source_id:"interview",
    explanation:"Lived experience fits phenomenology. Interviews offer privacy and depth.",
    teacher_note:"Prompt: Ask for two ethical considerations to mention in the notes field."
  },
  { id:"card_09", topic:"Developing study habits",
    rq:"How do study habits develop in a small peer group across the semester?",
    correct_design_id:"grounded_theory", correct_data_source_id:"observation",
    explanation:"Development suggests a process, fitting grounded theory. Observation captures repeated behaviors.",
    teacher_note:"Prompt: What ‘codes’ might appear from observation notes?"
  },
  { id:"card_10", topic:"Impact of a reading program",
    rq:"How did a school reading program influence the reading routines of a specific group of learners?",
    correct_design_id:"case_study", correct_data_source_id:"document_analysis",
    explanation:"A bounded program with a defined group fits case study. Document analysis uses logs/outputs/reflections.",
    teacher_note:"Prompt: List realistic documents/verifiable outputs in one week."
  }
];


window.__BANK__ = { DESIGN_LABELS, SOURCE_LABELS, PRETEST_ITEMS, POSTTEST_ITEMS, PRACTICE_CARDS };