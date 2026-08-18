// Mentorship form -> GitHub profile automation
//
// Deploy as a STANDALONE Apps Script project (script.google.com), not bound to
// either Form. Handles both the mentor and mentee sign-up forms and commits a
// new/updated profile (markdown + photo) straight to the mentorship site repo
// on every submission. See automation/SETUP.md for install steps.

// ===== CONFIGURATION — edit these =====
const GITHUB_OWNER = 'SASE-Drexel';
const GITHUB_REPO = 'mentorship-2026';
const GITHUB_BRANCH = 'main';
const SITE_REPO_SLUG = 'mentorship-2026'; // used to build the public image URL — bump this next year
const TIMEZONE = 'America/New_York';

// Fill in after creating each form. Find the ID in the form's edit URL:
// https://docs.google.com/forms/d/<THIS PART>/edit
const MENTOR_FORM_ID = 'PUT_MENTOR_FORM_ID_HERE';
const MENTEE_FORM_ID = 'PUT_MENTEE_FORM_ID_HERE';

// The GitHub token itself is NOT stored here — set it once via
// Project Settings (gear icon) > Script Properties > GITHUB_TOKEN.

// ===== FIELD MAPPING =====
// Keys are internal names; values must match the live form question text
// EXACTLY. If a title here stops matching the live form (question reworded),
// getAnswers_ throws immediately naming the mismatch, instead of failing
// silently the way a pandas rename-dict does.
const MENTOR_CONFIG = {
  collection: '_mentors',
  questions: {
    name: 'Name',
    year: 'Academic Year',
    coops: 'Prior Co-Ops (if applicable)',
    major: 'Major',
    concentration: 'Concentration',
    minor: 'Minor',
    about: 'Briefly describe yourself (~100 words or less)',
    interests: 'What are your interests? (~50 words or less)',
    career: 'What are your career goals? (~50 words or less)',
    whyMentor: 'Why would you like to be a SASE Mentor? (<100 words)',
    mentorStyle: 'What would your mentorship look like? How would you mentor your mentee? (<100 words)',
    relationship: 'How do you envision your relationship with your mentee?',
    photo: 'Please upload a photo of yourself for the Mentorship Profiles webpage!',
  },
  buildMarkdown: buildMentorMarkdown_,
};

const MENTEE_CONFIG = {
  collection: '_mentees',
  questions: {
    name: 'Name',
    year: 'Academic Year',
    major: 'Major',
    concentration: 'Concentration',
    minor: 'Minor',
    about: 'Briefly describe yourself (~100 words or less)',
    interests: 'List out your interests (~50 words or less)',
    career: 'What are your career goals? (~50 words or less)',
    lookingFor: 'What are you looking for in a mentor? This could be professional, academic, personal, etc., anything! (~100 words or less)',
    photo: 'Please upload a photo of yourself for the Mentorship Profiles webpage!',
  },
  buildMarkdown: buildMenteeMarkdown_,
};

// ===== TRIGGER ENTRY POINTS =====
// These are the functions the installable triggers call (see installTriggers below).
function onMentorFormSubmit(e) {
  processSubmission_(e, MENTOR_CONFIG);
}

function onMenteeFormSubmit(e) {
  processSubmission_(e, MENTEE_CONFIG);
}

// ===== ONE-TIME SETUP =====
// Run this once from the Apps Script editor (Run > installTriggers) after
// filling in the form IDs above. Safe to re-run; it replaces old triggers.
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onMentorFormSubmit').forForm(MENTOR_FORM_ID).onFormSubmit().create();
  ScriptApp.newTrigger('onMenteeFormSubmit').forForm(MENTEE_FORM_ID).onFormSubmit().create();
  Logger.log('Triggers installed for both forms.');
}

// ===== MANUAL TEST HELPERS =====
// Run these from the editor to replay the most recent real submission through
// the pipeline without needing a fresh test submission. Check the GitHub repo
// and the Executions log afterward.
function testMentorMapping() {
  replayLastResponse_(MENTOR_FORM_ID, MENTOR_CONFIG);
}

function testMenteeMapping() {
  replayLastResponse_(MENTEE_FORM_ID, MENTEE_CONFIG);
}

function replayLastResponse_(formId, config) {
  const responses = FormApp.openById(formId).getResponses();
  if (responses.length === 0) {
    Logger.log('No responses on this form yet.');
    return;
  }
  processSubmission_({ response: responses[responses.length - 1] }, config);
}

// ===== CORE PIPELINE =====
function processSubmission_(e, config) {
  const answers = getAnswers_(e, config.questions);
  const fullName = text_(answers, 'name');
  const dateStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');

  const slug = slugify_(fullName, '-');
  const imageFileName = slugify_(fullName, '_') + '.jpg';
  const imagePath = 'assets/images/' + imageFileName;
  const imageUrl = 'https://sase-drexel.github.io/' + SITE_REPO_SLUG + '/' + imagePath;

  const markdown = config.buildMarkdown(answers, {
    fullName: fullName,
    dateStr: dateStr,
    imagePath: imagePath,
    imageUrl: imageUrl,
  });

  const mdPath = config.collection + '/' + dateStr + '-' + slug + '.md';
  commitTextFile_(mdPath, markdown, 'Add/update profile: ' + fullName);

  const photoBlob = getUploadedPhotoBlob_(answers);
  if (photoBlob) {
    commitBinaryFile_(imagePath, photoBlob, 'Add/update photo: ' + fullName);
  } else {
    Logger.log('No photo found on submission for ' + fullName + ' — skipped image commit.');
  }
}

// Full name -> filename-safe slug, e.g. "Antonio Dietrich-Torres" -> "Antonio-Dietrich-Torres"
// (joins ALL words, unlike a first/last split which drops anything past the second word).
function slugify_(fullName, separator) {
  return fullName
    .trim()
    .replace(/\s+/g, separator)
    .replace(/[^a-zA-Z0-9_\-]/g, '');
}

// Matches answers to the question map by exact title text. Throws immediately
// (naming every unmatched question) instead of silently producing a KeyError
// several lines later, the way pandas' rename() does on a text mismatch.
function getAnswers_(e, questionMap) {
  const itemResponses = e.response.getItemResponses();
  const byTitle = {};
  itemResponses.forEach(function (ir) {
    byTitle[ir.getItem().getTitle().trim()] = ir;
  });

  const answers = {};
  const missing = [];
  Object.keys(questionMap).forEach(function (key) {
    const title = questionMap[key];
    const ir = byTitle[title];
    if (!ir) {
      missing.push('"' + title + '"');
      return;
    }
    answers[key] = ir;
  });

  if (missing.length > 0) {
    throw new Error(
      'Form question text no longer matches the script config: ' + missing.join(', ')
    );
  }
  return answers;
}

function text_(answers, key) {
  const value = answers[key].getResponse();
  return value ? value.toString().trim() : '';
}

function getUploadedPhotoBlob_(answers) {
  const ir = answers.photo;
  if (!ir) return null;
  const response = ir.getResponse(); // array of Drive file IDs for file-upload questions
  if (!response || response.length === 0) return null;
  return DriveApp.getFileById(response[0]).getBlob();
}

// ===== MARKDOWN BUILDERS =====
function yamlString_(value) {
  return '"' + String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function section_(heading, body) {
  if (!body) return '';
  return '### ' + heading + '\n\n' + body + '\n';
}

function imageDiv_(meta) {
  return (
    '<div class="text-center my-5">\n' +
    '    <img src="' + meta.imageUrl + '" alt="' + meta.fullName + '" class="rounded post-img" />\n' +
    '</div>'
  );
}

function buildMentorMarkdown_(answers, meta) {
  const about = text_(answers, 'about');
  const year = text_(answers, 'year');
  const major = text_(answers, 'major');
  const concentration = text_(answers, 'concentration');
  const minor = text_(answers, 'minor');
  const interests = text_(answers, 'interests');
  const career = text_(answers, 'career');
  const whyMentor = text_(answers, 'whyMentor');
  const mentorStyle = text_(answers, 'mentorStyle');
  const relationship = text_(answers, 'relationship');
  const coops = text_(answers, 'coops');

  const fm = ['---', 'layout: post'];
  fm.push('title: ' + yamlString_(meta.fullName));
  fm.push('date: ' + meta.dateStr);
  fm.push('image: ' + meta.imagePath);
  fm.push('about: ' + yamlString_(about));
  fm.push('year: ' + yamlString_(year));
  fm.push('major: ' + yamlString_(major));
  if (concentration) fm.push('concentration: ' + yamlString_(concentration));
  if (minor) fm.push('minor: ' + yamlString_(minor));
  fm.push('---');

  const body = [
    section_('About', about),
    section_('Interests', interests),
    section_('Career Goals', career),
    section_('Why I Want to Be a Mentor', whyMentor),
    section_('My Mentorship Style', mentorStyle),
    section_('How I Envision the Relationship', relationship),
  ];
  if (coops) body.push(section_('Prior Co-Ops', coops));
  body.push(imageDiv_(meta));

  return fm.join('\n') + '\n\n' + body.filter(String).join('\n');
}

function buildMenteeMarkdown_(answers, meta) {
  const about = text_(answers, 'about');
  const year = text_(answers, 'year');
  const major = text_(answers, 'major');
  const concentration = text_(answers, 'concentration');
  const minor = text_(answers, 'minor');
  const interests = text_(answers, 'interests');
  const career = text_(answers, 'career');
  const lookingFor = text_(answers, 'lookingFor');

  const fm = ['---', 'layout: post'];
  fm.push('title: ' + yamlString_(meta.fullName));
  fm.push('date: ' + meta.dateStr);
  fm.push('image: ' + meta.imagePath);
  fm.push('about: ' + yamlString_(about));
  fm.push('year: ' + yamlString_(year));
  fm.push('major: ' + yamlString_(major));
  if (concentration) fm.push('concentration: ' + yamlString_(concentration));
  if (minor) fm.push('minor: ' + yamlString_(minor));
  fm.push('---');

  const body = [
    section_('About', about),
    section_('Interests', interests),
    section_('Career Goals', career),
    section_('What I’m Looking For in a Mentor', lookingFor),
  ];
  body.push(imageDiv_(meta));

  return fm.join('\n') + '\n\n' + body.filter(String).join('\n');
}

// ===== GITHUB COMMIT HELPERS =====
function commitTextFile_(path, textContent, message) {
  putFile_(path, Utilities.base64Encode(textContent, Utilities.Charset.UTF_8), message);
}

function commitBinaryFile_(path, blob, message) {
  putFile_(path, Utilities.base64Encode(blob.getBytes()), message);
}

function putFile_(path, base64Content, message) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKEN script property is not set.');

  const apiUrl =
    'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/contents/' + path;
  const headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
  };

  // Look up the existing file's sha (if any) — required by the GitHub API to
  // update rather than create, e.g. when someone edits/resubmits their form response.
  let sha = null;
  const getResp = UrlFetchApp.fetch(apiUrl + '?ref=' + GITHUB_BRANCH, {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true,
  });
  if (getResp.getResponseCode() === 200) {
    sha = JSON.parse(getResp.getContentText()).sha;
  }

  const payload = { message: message, content: base64Content, branch: GITHUB_BRANCH };
  if (sha) payload.sha = sha;

  const putResp = UrlFetchApp.fetch(apiUrl, {
    method: 'put',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = putResp.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error('GitHub commit failed (' + code + ') for ' + path + ': ' + putResp.getContentText());
  }
}
