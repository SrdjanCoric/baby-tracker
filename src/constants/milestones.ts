export type MilestoneCategory = "social" | "language" | "cognitive" | "movement";

export interface MilestoneItem {
  id: string;
  category: MilestoneCategory;
  text: string;
}

export interface AgeGroup {
  key: string;
  label: string;
  months: number;
  milestones: MilestoneItem[];
}

export const CATEGORY_EMOJI: Record<MilestoneCategory, string> = {
  social: "\u{1F49B}",
  language: "\u{1F4AC}",
  cognitive: "\u{1F9E0}",
  movement: "\u{1F3C3}",
};

export const CATEGORY_ORDER: MilestoneCategory[] = ["social", "language", "cognitive", "movement"];

export const AGE_GROUPS: AgeGroup[] = [
  {
    key: "2m",
    label: "by 2 mo",
    months: 2,
    milestones: [
      { id: "2m-social-1", category: "social", text: "Calms down when spoken to or picked up" },
      { id: "2m-social-2", category: "social", text: "Looks at your face" },
      { id: "2m-social-3", category: "social", text: "Seems happy to see you when you walk up to her" },
      { id: "2m-social-4", category: "social", text: "Smiles when you talk to or smile at her" },
      { id: "2m-language-1", category: "language", text: "Makes sounds other than crying" },
      { id: "2m-language-2", category: "language", text: "Reacts to loud sounds" },
      { id: "2m-cognitive-1", category: "cognitive", text: "Watches you as you move" },
      { id: "2m-cognitive-2", category: "cognitive", text: "Looks at a toy for several seconds" },
      { id: "2m-movement-1", category: "movement", text: "Holds head up when on tummy" },
      { id: "2m-movement-2", category: "movement", text: "Moves both arms and both legs" },
      { id: "2m-movement-3", category: "movement", text: "Opens hands briefly" },
    ],
  },
  {
    key: "4m",
    label: "by 4 mo",
    months: 4,
    milestones: [
      { id: "4m-social-1", category: "social", text: "Smiles on his own to get your attention" },
      { id: "4m-social-2", category: "social", text: "Chuckles (not yet a full laugh) when you try to make him laugh" },
      { id: "4m-social-3", category: "social", text: "Looks at you, moves, or makes sounds to get or keep your attention" },
      { id: "4m-language-1", category: "language", text: "Makes sounds like \"oooo\", \"aahh\" (cooing)" },
      { id: "4m-language-2", category: "language", text: "Makes sounds back when you talk to him" },
      { id: "4m-language-3", category: "language", text: "Turns head towards the sound of your voice" },
      { id: "4m-cognitive-1", category: "cognitive", text: "If hungry, opens mouth when she sees breast or bottle" },
      { id: "4m-cognitive-2", category: "cognitive", text: "Looks at her hands with interest" },
      { id: "4m-movement-1", category: "movement", text: "Holds head steady without support when you are holding her" },
      { id: "4m-movement-2", category: "movement", text: "Holds a toy when you put it in her hand" },
      { id: "4m-movement-3", category: "movement", text: "Uses her arm to swing at toys" },
      { id: "4m-movement-4", category: "movement", text: "Brings hands to mouth" },
      { id: "4m-movement-5", category: "movement", text: "Pushes up onto elbows/forearms when on tummy" },
    ],
  },
  {
    key: "6m",
    label: "by 6 mo",
    months: 6,
    milestones: [
      { id: "6m-social-1", category: "social", text: "Knows familiar people" },
      { id: "6m-social-2", category: "social", text: "Likes to look at himself in a mirror" },
      { id: "6m-social-3", category: "social", text: "Laughs" },
      { id: "6m-language-1", category: "language", text: "Takes turns making sounds with you" },
      { id: "6m-language-2", category: "language", text: "Blows \"raspberries\" (sticks tongue out and blows)" },
      { id: "6m-language-3", category: "language", text: "Makes squealing noises" },
      { id: "6m-cognitive-1", category: "cognitive", text: "Puts things in her mouth to explore them" },
      { id: "6m-cognitive-2", category: "cognitive", text: "Reaches to grab a toy she wants" },
      { id: "6m-cognitive-3", category: "cognitive", text: "Closes lips to show she doesn't want more food" },
      { id: "6m-movement-1", category: "movement", text: "Rolls from tummy to back" },
      { id: "6m-movement-2", category: "movement", text: "Pushes up with straight arms when on tummy" },
      { id: "6m-movement-3", category: "movement", text: "Leans on hands to support himself when sitting" },
    ],
  },
  {
    key: "9m",
    label: "by 9 mo",
    months: 9,
    milestones: [
      { id: "9m-social-1", category: "social", text: "Is shy, clingy, or fearful around strangers" },
      { id: "9m-social-2", category: "social", text: "Shows several facial expressions, like happy, sad, angry, and surprised" },
      { id: "9m-social-3", category: "social", text: "Looks when you call her name" },
      { id: "9m-social-4", category: "social", text: "Reacts when you leave (looks, reaches for you, or cries)" },
      { id: "9m-social-5", category: "social", text: "Smiles or laughs when you play peek-a-boo" },
      { id: "9m-language-1", category: "language", text: "Makes different sounds like \"mamamama\" and \"babababa\"" },
      { id: "9m-language-2", category: "language", text: "Lifts arms up to be picked up" },
      { id: "9m-cognitive-1", category: "cognitive", text: "Looks for objects when dropped out of sight (like his spoon or toy)" },
      { id: "9m-cognitive-2", category: "cognitive", text: "Bangs two things together" },
      { id: "9m-movement-1", category: "movement", text: "Gets to a sitting position by herself" },
      { id: "9m-movement-2", category: "movement", text: "Moves things from one hand to her other hand" },
      { id: "9m-movement-3", category: "movement", text: "Uses fingers to \"rake\" food towards himself" },
      { id: "9m-movement-4", category: "movement", text: "Sits without support" },
    ],
  },
  {
    key: "1y",
    label: "by 1 yr",
    months: 12,
    milestones: [
      { id: "1y-social-1", category: "social", text: "Plays games with you, like pat-a-cake" },
      { id: "1y-social-2", category: "social", text: "Waves \"bye-bye\"" },
      { id: "1y-social-3", category: "social", text: "Calls a parent \"mama\" or \"dada\" or another special name" },
      { id: "1y-social-4", category: "social", text: "Understands \"no\" (pauses briefly or stops when you say it)" },
      { id: "1y-language-1", category: "language", text: "Puts something in a container, like a block in a cup" },
      { id: "1y-language-2", category: "language", text: "Looks for things he sees you hide, like a toy under a blanket" },
      { id: "1y-cognitive-1", category: "cognitive", text: "Pulls up to stand" },
      { id: "1y-cognitive-2", category: "cognitive", text: "Walks, holding on to furniture" },
      { id: "1y-movement-1", category: "movement", text: "Drinks from a cup without a lid, as you hold it" },
      { id: "1y-movement-2", category: "movement", text: "Picks things up between thumb and pointer finger, like small bits of food" },
    ],
  },
  {
    key: "15m",
    label: "by 15 mo",
    months: 15,
    milestones: [
      { id: "15m-social-1", category: "social", text: "Copies other children while playing, like taking toys out of a container when another child does" },
      { id: "15m-social-2", category: "social", text: "Shows you an object she likes" },
      { id: "15m-social-3", category: "social", text: "Claps when excited" },
      { id: "15m-social-4", category: "social", text: "Hugs stuffed doll or other toy" },
      { id: "15m-social-5", category: "social", text: "Shows you affection (hugs, cuddles, or kisses you)" },
      { id: "15m-language-1", category: "language", text: "Tries to say one or two words besides \"mama\" or \"dada\", like \"ba\" for ball or \"da\" for dog" },
      { id: "15m-language-2", category: "language", text: "Looks at a familiar object when you name it" },
      { id: "15m-language-3", category: "language", text: "Follows directions given with both a gesture and words, e.g. he gives you a toy when you hold out your hand and say \"Give me the toy\"" },
      { id: "15m-language-4", category: "language", text: "Points to ask for something or to get help" },
      { id: "15m-cognitive-1", category: "cognitive", text: "Tries to use things the right way, like a phone, cup, or book" },
      { id: "15m-cognitive-2", category: "cognitive", text: "Stacks at least two small objects, like blocks" },
      { id: "15m-movement-1", category: "movement", text: "Takes a few steps on his own" },
      { id: "15m-movement-2", category: "movement", text: "Uses fingers to feed herself some food" },
    ],
  },
  {
    key: "18m",
    label: "by 18 mo",
    months: 18,
    milestones: [
      { id: "18m-social-1", category: "social", text: "Moves away from you, but looks to make sure you are close by" },
      { id: "18m-social-2", category: "social", text: "Points to show you something interesting" },
      { id: "18m-social-3", category: "social", text: "Puts hands out for you to wash them" },
      { id: "18m-social-4", category: "social", text: "Looks at a few pages in a book with you" },
      { id: "18m-social-5", category: "social", text: "Helps you dress him by pushing arm through sleeve or lifting up foot" },
      { id: "18m-language-1", category: "language", text: "Tries to say three or more words besides \"mama\" or \"dada\"" },
      { id: "18m-language-2", category: "language", text: "Follows one-step directions without any gestures, like giving you the toy when you say \"Give it to me\"" },
      { id: "18m-cognitive-1", category: "cognitive", text: "Copies you doing chores, like sweeping with a broom" },
      { id: "18m-cognitive-2", category: "cognitive", text: "Plays with toys in a simple way, like pushing a toy car" },
      { id: "18m-movement-1", category: "movement", text: "Walks without holding on to anyone or anything" },
      { id: "18m-movement-2", category: "movement", text: "Scribbles" },
      { id: "18m-movement-3", category: "movement", text: "Drinks from a cup without a lid and may spill sometimes" },
      { id: "18m-movement-4", category: "movement", text: "Feeds herself with her fingers" },
      { id: "18m-movement-5", category: "movement", text: "Tries to use a spoon" },
      { id: "18m-movement-6", category: "movement", text: "Climbs on and off a couch or chair without help" },
    ],
  },
  {
    key: "2y",
    label: "by 2 yr",
    months: 24,
    milestones: [
      { id: "2y-social-1", category: "social", text: "Notices when others are hurt or upset, like pausing or looking sad when he hears someone crying" },
      { id: "2y-social-2", category: "social", text: "Looks at your face to see how to react in a new situation" },
      { id: "2y-language-1", category: "language", text: "Points to things in a book when you ask, like \"Where is the bear?\"" },
      { id: "2y-language-2", category: "language", text: "Says at least two words together, like \"More milk\"" },
      { id: "2y-language-3", category: "language", text: "Points to at least two body parts when you ask him to show you" },
      { id: "2y-language-4", category: "language", text: "Uses more gestures than just waving and pointing, like blowing a kiss or nodding yes" },
      { id: "2y-cognitive-1", category: "cognitive", text: "Holds something in one hand while using the other hand, like holding a container and taking the lid off" },
      { id: "2y-cognitive-2", category: "cognitive", text: "Tries to use switches, knobs, or buttons on a toy" },
      { id: "2y-cognitive-3", category: "cognitive", text: "Plays with more than one toy at the same time, like putting toy food on a toy plate" },
      { id: "2y-movement-1", category: "movement", text: "Kicks a ball" },
      { id: "2y-movement-2", category: "movement", text: "Runs" },
      { id: "2y-movement-3", category: "movement", text: "Walks (not climbs) up a few stairs with or without help" },
      { id: "2y-movement-4", category: "movement", text: "Eats with a spoon" },
    ],
  },
  {
    key: "30m",
    label: "by 30 mo",
    months: 30,
    milestones: [
      { id: "30m-social-1", category: "social", text: "Plays next to other children and sometimes plays with them" },
      { id: "30m-social-2", category: "social", text: "Shows you what she can do by saying \"Look at me!\"" },
      { id: "30m-social-3", category: "social", text: "Follows simple routines when told, like helping to pick up toys when you say \"It's clean-up time\"" },
      { id: "30m-language-1", category: "language", text: "Says about 50 words" },
      { id: "30m-language-2", category: "language", text: "Says two or more words together, with one action word, like \"Doggie run\"" },
      { id: "30m-language-3", category: "language", text: "Names things in a book when you point and ask \"What is this?\"" },
      { id: "30m-language-4", category: "language", text: "Says words like \"I\", \"me\", or \"we\"" },
      { id: "30m-cognitive-1", category: "cognitive", text: "Uses things to pretend, like feeding a block to a doll as if it were food" },
      { id: "30m-cognitive-2", category: "cognitive", text: "Shows simple problem-solving skills, like standing on a small stool to reach something" },
      { id: "30m-cognitive-3", category: "cognitive", text: "Follows two-step instructions like \"Put the toy down and close the door\"" },
      { id: "30m-cognitive-4", category: "cognitive", text: "Shows he knows at least one color, like pointing to a red crayon when you ask \"Which one is red?\"" },
      { id: "30m-movement-1", category: "movement", text: "Uses hands to twist things, like turning doorknobs or unscrewing lids" },
      { id: "30m-movement-2", category: "movement", text: "Takes some clothes off by herself, like loose pants or an open jacket" },
      { id: "30m-movement-3", category: "movement", text: "Jumps off the ground with both feet" },
      { id: "30m-movement-4", category: "movement", text: "Turns book pages, one at a time, when you read to her" },
    ],
  },
  {
    key: "3y",
    label: "by 3 yr",
    months: 36,
    milestones: [
      { id: "3y-social-1", category: "social", text: "Calms down within 10 minutes after you leave her, like at a childcare drop-off" },
      { id: "3y-social-2", category: "social", text: "Notices other children and joins them to play" },
      { id: "3y-language-1", category: "language", text: "Talks with you in conversation using at least two back-and-forth exchanges" },
      { id: "3y-language-2", category: "language", text: "Asks \"who\", \"what\", \"where\", or \"why\" questions, like \"Where is mommy/daddy?\"" },
      { id: "3y-language-3", category: "language", text: "Says what action is happening in a picture or book when asked, like \"running\", \"eating\", or \"playing\"" },
      { id: "3y-language-4", category: "language", text: "Says first name, when asked" },
      { id: "3y-language-5", category: "language", text: "Talks well enough for others to understand, most of the time" },
      { id: "3y-cognitive-1", category: "cognitive", text: "Draws a circle, when you show him how" },
      { id: "3y-cognitive-2", category: "cognitive", text: "Avoids touching hot objects, like a stove, when you warn her" },
      { id: "3y-movement-1", category: "movement", text: "Strings items together, like large beads or macaroni" },
      { id: "3y-movement-2", category: "movement", text: "Puts on some clothes by himself, like loose pants or a jacket" },
      { id: "3y-movement-3", category: "movement", text: "Uses a fork" },
    ],
  },
  {
    key: "4y",
    label: "by 4 yr",
    months: 48,
    milestones: [
      { id: "4y-social-1", category: "social", text: "Pretends to be something else during play (teacher, superhero, dog)" },
      { id: "4y-social-2", category: "social", text: "Asks to go play with children if none are around, like \"Can I play with Alex?\"" },
      { id: "4y-social-3", category: "social", text: "Comforts others who are hurt or sad, like hugging a crying friend" },
      { id: "4y-social-4", category: "social", text: "Avoids danger, like not jumping from tall heights at the playground" },
      { id: "4y-social-5", category: "social", text: "Likes to be a \"helper\"" },
      { id: "4y-social-6", category: "social", text: "Changes behavior based on where she is (place of worship, library, playground)" },
      { id: "4y-language-1", category: "language", text: "Says sentences with four or more words" },
      { id: "4y-language-2", category: "language", text: "Says some words from a song, story, or nursery rhyme" },
      { id: "4y-language-3", category: "language", text: "Talks about at least one thing that happened during the day, like \"I played soccer\"" },
      { id: "4y-language-4", category: "language", text: "Answers simple questions like \"What is a coat for?\" or \"What is a crayon for?\"" },
      { id: "4y-cognitive-1", category: "cognitive", text: "Names a few colors of items" },
      { id: "4y-cognitive-2", category: "cognitive", text: "Tells what comes next in a well-known story" },
      { id: "4y-cognitive-3", category: "cognitive", text: "Draws a person with three or more body parts" },
      { id: "4y-movement-1", category: "movement", text: "Catches a large ball most of the time" },
      { id: "4y-movement-2", category: "movement", text: "Serves himself food or pours water, with adult supervision" },
      { id: "4y-movement-3", category: "movement", text: "Unbuttons some buttons" },
      { id: "4y-movement-4", category: "movement", text: "Holds crayon or pencil between fingers and thumb (not a fist)" },
    ],
  },
  {
    key: "5y",
    label: "by 5 yr",
    months: 60,
    milestones: [
      { id: "5y-social-1", category: "social", text: "Follows rules or takes turns when playing games with other children" },
      { id: "5y-social-2", category: "social", text: "Sings, dances, or acts for you" },
      { id: "5y-social-3", category: "social", text: "Does simple chores at home, like matching socks or clearing the table after eating" },
      { id: "5y-language-1", category: "language", text: "Tells a story she heard or made up with at least two events, like a cat was stuck in a tree and a firefighter saved it" },
      { id: "5y-language-2", category: "language", text: "Answers simple questions about a book or story after you read or tell it to him" },
      { id: "5y-language-3", category: "language", text: "Keeps a conversation going with more than three back-and-forth exchanges" },
      { id: "5y-language-4", category: "language", text: "Uses or recognizes simple rhymes (bat-cat, ball-tall)" },
      { id: "5y-cognitive-1", category: "cognitive", text: "Counts to 10" },
      { id: "5y-cognitive-2", category: "cognitive", text: "Names some numbers between 1 and 5 when you point to them" },
      { id: "5y-cognitive-3", category: "cognitive", text: "Uses words about time, like \"yesterday\", \"tomorrow\", \"morning\", or \"night\"" },
      { id: "5y-cognitive-4", category: "cognitive", text: "Pays attention for 5 to 10 minutes during activities, like during story time or making arts and crafts" },
      { id: "5y-cognitive-5", category: "cognitive", text: "Writes some letters in her name" },
      { id: "5y-cognitive-6", category: "cognitive", text: "Names some letters when you point to them" },
      { id: "5y-movement-1", category: "movement", text: "Buttons some buttons" },
      { id: "5y-movement-2", category: "movement", text: "Hops on one foot" },
    ],
  },
];

export function getCurrentAgeGroupKey(birthDate: Date): string | null {
  const now = new Date();
  const ageMs = now.getTime() - birthDate.getTime();
  const ageMonths = ageMs / (1000 * 60 * 60 * 24 * 30.44);

  if (ageMonths < 2) return null;

  const sortedGroups = [...AGE_GROUPS].sort((a, b) => b.months - a.months);
  for (const group of sortedGroups) {
    if (ageMonths >= group.months) {
      return group.key;
    }
  }

  return null;
}

export function getAgeGroupByKey(key: string): AgeGroup | undefined {
  return AGE_GROUPS.find((g) => g.key === key);
}

export function getMilestonesForAge(ageKey: string): MilestoneItem[] {
  const group = getAgeGroupByKey(ageKey);
  return group?.milestones ?? [];
}

export function getMilestonesByCategory(ageKey: string): Record<MilestoneCategory, MilestoneItem[]> {
  const milestones = getMilestonesForAge(ageKey);
  return {
    social: milestones.filter((m) => m.category === "social"),
    language: milestones.filter((m) => m.category === "language"),
    cognitive: milestones.filter((m) => m.category === "cognitive"),
    movement: milestones.filter((m) => m.category === "movement"),
  };
}
