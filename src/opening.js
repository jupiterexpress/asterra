import {Store} from '../shared/store.js';
import { S } from './state.js';
import { createOpeningScene } from './opening-scene.js';

const $ = id => document.getElementById(id);
const profileFields={'asterra-contractor':'name','asterra-opening-complete':'opening','polycube-tutorial-complete':'tutorial'};
export const readSave=key=>{const value=Store.data.profile[profileFields[key]];return typeof value==='boolean'?(value?'1':null):value;};
export const writeSave=(key,value)=>{const field=profileFields[key];if(field)Store.profile(field,field==='name'?value:value==='1');};

const chapters = [
  ['YOUR STORY STARTS HERE', 'WELCOME TO ASTERRA', '', 'CONTRACTOR REGISTRY'],
  ['OFFICIALLY ONE OF US', '', 'A small contractor. A city of possibilities.', 'CONTRACTOR REGISTERED'],
  ['A CITY WORTH BUILDING FOR', 'A PLACE CALLED HOME.', 'Asterra was once a thriving city.', 'ASTERRA · BEFORE THE QUAKE'],
  ['THE NIGHT EVERYTHING CHANGED', 'THEN THE EARTH MOVED.', 'Then a massive earthquake struck.', 'ASTERRA · THE EARTHQUAKE'],
  ['A NEW BEGINNING', 'ROOM TO BEGIN AGAIN.', "Much of the city’s buildings were lost, and Asterra needs to be rebuilt.", 'ASTERRA · AFTER THE QUAKE'],
  ['YOUR PART IN THE STORY', 'YOU’RE OUR CONTRACTOR.', 'The city has chosen you as one of its contractors.\nYour job is to design and build the structures Asterra needs.', 'ASTERRA REBUILDING OFFICE'],
  ['FROM POSSIBILITY TO PLAN', 'EVERY BUILD BEGINS\nWITH A BLUEPRINT.', 'Each contract gives you a blueprint.\nBuild the structure by stacking and shaping your tiles to match it.', 'CONTRACT 001 · THE LANTERN HOUSE'],
  ['MAKE EVERY SPACE COUNT', 'SMALL SPACE.\nBIG POSSIBILITIES.', 'The more efficiently you use the space in your blueprint, the denser your building is.\nHigher density earns you more coins, which you can use to improve and customize the buildings you create.', 'DENSITY → COINS → POSSIBILITIES'],
  ['LET’S BUILD SOMETHING TOGETHER', 'YOUR FIRST CONTRACT\nIS WAITING.', 'The citizens of Asterra are counting on you.', 'ASTERRA · A FUTURE TAKING SHAPE'],
];

export const Opening = {
  active: false, chapter: 0, name: '', visual: null,
  init(api) {
    this.api = api;
    $('contractorForm').addEventListener('submit', e => {
      e.preventDefault();
      const name = $('contractorName').value.trim().replace(/\s+/g, ' ');
      if (!name) { $('nameError').textContent = 'Tell us what to call you.'; $('contractorName').focus(); return; }
      this.name = name; writeSave('asterra-contractor', name);
      $('nameError').textContent = ''; this.show(1);
    });
    $('openingNext').addEventListener('click', () => this.next());
    $('openingBack').addEventListener('click', () => this.show(this.chapter - 1));
    $('openingCanvas').addEventListener('click', () => { if (this.chapter > 0) this.next(); });
    $('openingReplay').addEventListener('click', () => this.start());
    $('openingProgress').innerHTML = chapters.map(() => '<span></span>').join('');
  },
  start() {
    this.api.reset();
    this.active = true; S.screen = 'opening';
    $('opening').hidden = false; $('controls').hidden = true;
    document.querySelector('.hud-top').inert = true;
    $('sheet').hidden = true;
    document.body.classList.add('opening-active');
    this.name = readSave('asterra-contractor') || '';
    $('contractorName').value = this.name;
    this.visual ||= createOpeningScene($('openingCanvas'));
    this.show(0);
  },
  show(index) {
    this.chapter = Math.max(0, Math.min(chapters.length - 1, index));
    const [eyebrow, title, text, location] = chapters[this.chapter];
    $('openingEyebrow').textContent = eyebrow;
    $('openingTitle').textContent = this.chapter === 1 ? `Welcome, ${this.name}.` : title;
    $('openingText').textContent = text;
    // Emphasis is built as text nodes so contractor names can never become markup.
    if (this.chapter === 7) {
      $('openingText').replaceChildren();
      text.split(/(denser|Higher density|more coins)/).forEach((part, i) => {
        const node = document.createElement(i % 2 ? 'strong' : 'span'); node.textContent = part; $('openingText').appendChild(node);
      });
    }
    $('openingLocation').textContent = location;
    $('openingChapter').textContent = `${String(this.chapter + 1).padStart(2, '0')} / 09`;
    $('contractorForm').hidden = this.chapter !== 0;
    $('openingNext').hidden = this.chapter === 0;
    $('openingNext').textContent = this.chapter === 8 ? 'HOW TO PLAY →' : this.chapter === 1 ? 'MEET ASTERRA →' : 'CONTINUE →';
    $('openingBack').hidden = this.chapter === 0;
    $('openingPace').textContent = this.chapter === 0 ? 'A short story. Move at your own pace.' : 'Tap the scene or continue when you’re ready.';
    [...$('openingProgress').children].forEach((el, i) => el.classList.toggle('visited', i <= this.chapter));
    this.visual.setStep(this.chapter);
    if (this.chapter > 0) $('openingNext').focus({ preventScroll: true });
  },
  next() {
    if (!this.active) return;
    if (this.chapter < chapters.length - 1) { this.show(this.chapter + 1); return; }
    writeSave('asterra-opening-complete', '1');
    this.active = false; S.screen = '';
    $('opening').hidden = true; document.body.classList.remove('opening-active');
    this.api.tutorial();
  },
  render(dt) { if (this.active) this.visual.render(dt); },
};
