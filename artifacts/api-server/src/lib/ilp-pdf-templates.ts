import type { ReviewTemplateContent } from "@workspace/db";

// Source: supplied seven-page ILP Learner Review. The welcome mentions four
// files, but only three substantive reviews exist. Navigation is adapted only.
export const ILP_WELCOME = "Welcome to Your ILP (Individual Learning Plan). You and your RG teacher will complete one ILP each term. During your ILP discussions, you’ll talk about your progress and set new targets to help you stay on track and achieve your goals.\n\nThis document is private — it’s just for you and your RG teacher. If anyone else needs to view it, they’ll only do so to help support you, and they’ll discuss it with you and your RG teacher first.\n\nOpen your current term from My ILP Reviews to complete the section your RG teacher has asked you to work on. There are three term reviews in this app.";
const topicNote = "Below are some possible topics that may be discussed with your RG teacher. You may answer ‘Discuss with my RG teacher’ instead of sharing sensitive personal details in writing.";
function section(term: number, id: string, title: string, prompts: string[]) {
  return { id: `t${term}-${id}`, title, instructions: "", questions: prompts.map((prompt, i) => ({ id: `t${term}-${id}-${i + 1}`, prompt, required: true })) };
}
export const PDF_ILP_TEMPLATES: ReviewTemplateContent[] = [
  {
    title: "ILP 1 — Getting to Know You", welcome: ILP_WELCOME,
    instructions: "Welcome to your ILP (Individual Learning Plan). You and your RG teacher will complete one per term. Remember: you’ll need to talk to your RG teacher and set some targets. These targets will be reviewed every ILP.\n\n" + topicNote,
    endGuidance: "You’ve almost completed your ILP for Term 1. Hopefully you’ve had a great discussion around ‘getting to know you’. Following the discussion you’ve just had with your RG teacher it’s now time to set some targets. You’ll review these targets at the start of your second ILP (in Term 2) to see how you’ve been getting on. Targets can have various steps — think of these as steps (things you’ll do) to reach your overall target.\n\nYou have reached the end of ILP for Term 1. Submit to Tutor to save and send your responses. Once your teacher has completed and dated the review, return in Term 2 to complete the next section.",
    targetExamples: { academic: "Improve my understanding of fractions in maths.", personal: "Join a school club or participate more in class.", future: "Research a career that interests me." },
    sections: [
      section(1, "general", "General Questions", [
        "What have been some of your best and most challenging experiences in school so far?",
        "What subjects do you enjoy the most and why?",
        "What subjects or topics do you find most difficult?",
        "What are you looking forward to this year at school?",
        "What do you hope to achieve by the end of this term or year (in school or personally)?",
        "How do you learn best (for example, by reading, listening, doing practical work, or discussing ideas)?",
        "Is there anything that worries you about school or learning this year?",
      ]),
      section(1, "personal", "Personal Development", [
        "What makes you happy or motivated to do your best?",
        "How do you like to spend your free time?",
        "What positive habits could you build this term to help you achieve your goals (e.g., organisation, attendance, effort, wellbeing)?",
        "Do you feel you need any extra help or support with anything in or outside of school?",
      ]),
      section(1, "future", "Future Aspirations", [
        "What kind of job or career do you think you might like in the future?",
        "What subjects or skills do you think will help you get there?",
        "Is there something new you’d like to try this year to help you explore your interests?",
      ]),
      section(1, "academic", "Academic Progress", [
        "How do you feel you’re doing in your subjects so far?",
        "Are there any areas you’d like extra help or guidance in?",
        "How do you plan to stay organised with homework, projects, and revision?",
      ]),
    ],
  },
  {
    title: "ILP 2 — Check in/Forecast", welcome: ILP_WELCOME,
    instructions: "Thanks for opening your ILP for Term 2! Hopefully, you’ll have a great discussion about how things are progressing for you so far. Before your conversation with your RG teacher, read back through your ‘Summary of Discussion’ from ILP 1. It will remind you of what you talked about last term and help your teacher add updates for this review.\n\nYou’ll also need to review your targets: What steps have you taken to achieve them? Are those steps listed under your target, or do you need to add something new? Have any targets now been completed? If so, remember to tick them off. Do you have any new targets to add? Write them in below.\n\n" + topicNote,
    endGuidance: "You’ve reached the end of your ILP for Term 2. Remember: following your discussion with your RG teacher, it’s now time to review and update your targets. Submit to Tutor to save and send your responses. Once your targets have been completed, dated, and updated, you’ll return in Term 3 to complete the next section.",
    targetExamples: { academic: "Improve my spelling and grammar in English assignments.", personal: "Try to participate more confidently in group discussions.", future: "Explore new clubs or subjects that match my future interests." },
    sections: [
      section(2, "reflection", "Reflection", [
        "Since the start of the year, how do you feel you’ve improved — in school or personally?",
        "Which of your Term 1 targets have you achieved? How did you achieve them?",
        "What have you enjoyed learning about the most this year, and why?",
        "Is there anything you’ve learned about yourself that has surprised you?",
      ]),
      section(2, "barriers", "Overcoming Barriers", [
        "Have you faced any challenges this term, in lessons or outside of school?",
        "What helped you deal with these challenges?",
        "Is there anything that still makes learning difficult for you?",
        "What could you do differently next term to overcome these challenges?",
      ]),
      section(2, "future", "Future Aspirations", [
        "Have your ideas about future jobs or careers changed since Term 1?",
        "What new skills have you developed that might help your future goals?",
        "What could you do next term to learn more about your interests or career ideas?",
      ]),
      section(2, "success", "Celebrating Success", [
        "What achievement are you most proud of this term?",
        "Who has helped or supported you in reaching your goals?",
        "How will you celebrate your progress or reward yourself for your hard work?",
      ]),
      section(2, "academic", "Academic Progress", [
        "How do you feel you’re getting on in your subjects this term?",
        "Are you managing your homework, revision, and classwork well?",
        "How could you become even more organised or motivated next term?",
        "Is there anything your teachers could do to help you more?",
      ]),
    ],
  },
  {
    title: "ILP 3 — Progression & Reflection", welcome: ILP_WELCOME,
    instructions: "Thanks for opening your ILP for Term 3. Read back through your ‘Summary of Discussion’ from ILP 1 and 2 before your conversation with your RG teacher as they will remind you of what you discussed and add information for this discussion in Term 3.\n\nYou’ll also need to review your targets. What steps have you taken to achieving them? Are these steps listed underneath your target or is there something else you need to add here? Have targets now been completed — remember to tick them off if so. Have any new targets been created? Add them in.\n\n" + topicNote,
    endGuidance: "Well done, you have reached the end of the ILP for Term 3. Remember: following your discussion with your RG teacher, it’s now time to review, update and complete your targets. Once this has been completed, click ‘Submit to Tutor’ to save the responses and submit the ILP. Your RG teacher will add their comment and date the final review.",
    targetExamples: { academic: "Prepare thoroughly for end-of-year assessments and review teacher feedback.", personal: "Keep developing confidence by helping others or taking on more responsibility.", future: "Research subjects or courses I might want to take next year." },
    sections: [
      section(3, "reflection", "Reflection", [
        "Looking back over the year, what are you most proud of?",
        "Which targets have you achieved since the start of the year? How did you do it?",
        "What challenges have you faced and how have you overcome them?",
        "What have you enjoyed learning about the most and why?",
        "How have you changed or improved as a learner and as a person this year?",
        "What advice would you give yourself at the start of next year?",
      ]),
      section(3, "academic", "Academic Progress", [
        "How do you feel about your progress in your subjects this year?",
        "Which subjects have you improved in most, and what helped you achieve that?",
        "Is there anything you still want to work on next year?",
        "How have you managed your homework, revision, and classwork throughout the year?",
        "What strategies have helped you learn best?",
      ]),
      section(3, "future", "Future Aspirations", [
        "Have your ideas about future jobs, courses, or pathways changed this year?",
        "What new skills or strengths have you developed that might help you in the future?",
        "What are you most looking forward to next year — either in school or beyond?",
        "Is there anything you’d like to try or learn more about to help you reach your goals?",
      ]),
      section(3, "success", "Celebrating Your Success", [
        "What achievement this year are you most proud of?",
        "Who has helped or supported you the most this year?",
        "How will you celebrate your progress and success?",
      ]),
    ],
  },
];