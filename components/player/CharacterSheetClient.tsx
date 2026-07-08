'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import type { Campaign, Character, Spell, InventoryItem } from '@/types'

interface Props {
  campaign: Campaign
  character: Character | null
  role: 'dm' | 'player'
}

// ── D&D Data ────────────────────────────────────────────────

const SKILLS = [
  { name: 'Acrobatics',     ability: 'dex' },
  { name: 'Animal Handling',ability: 'wis' },
  { name: 'Arcana',         ability: 'int' },
  { name: 'Athletics',      ability: 'str' },
  { name: 'Deception',      ability: 'cha' },
  { name: 'History',        ability: 'int' },
  { name: 'Insight',        ability: 'wis' },
  { name: 'Intimidation',   ability: 'cha' },
  { name: 'Investigation',  ability: 'int' },
  { name: 'Medicine',       ability: 'wis' },
  { name: 'Nature',         ability: 'int' },
  { name: 'Perception',     ability: 'wis' },
  { name: 'Performance',    ability: 'cha' },
  { name: 'Persuasion',     ability: 'cha' },
  { name: 'Religion',       ability: 'int' },
  { name: 'Sleight of Hand',ability: 'dex' },
  { name: 'Stealth',        ability: 'dex' },
  { name: 'Survival',       ability: 'wis' },
] as const

const ABILITIES = ['str','dex','con','int','wis','cha'] as const
const ABILITY_LABELS: Record<string,string> = {
  str:'Strength',dex:'Dexterity',con:'Constitution',
  int:'Intelligence',wis:'Wisdom',cha:'Charisma',
}

const SUBCLASSES: Record<string, string[]> = {
  'Barbarian': ['Path of the Berserker','Path of the Totem Warrior','Path of the Ancestral Guardian','Path of the Storm Herald','Path of the Zealot','Path of the Beast','Path of Wild Magic'],
  'Bard':      ['College of Lore','College of Valor','College of Glamour','College of Swords','College of Whispers','College of Creation','College of Eloquence','College of Spirits'],
  'Cleric':    ['Knowledge Domain','Life Domain','Light Domain','Nature Domain','Tempest Domain','Trickery Domain','War Domain','Arcana Domain','Death Domain','Forge Domain','Grave Domain','Order Domain','Peace Domain','Twilight Domain'],
  'Druid':     ['Circle of the Land','Circle of the Moon','Circle of Dreams','Circle of the Shepherd','Circle of Spores','Circle of Stars','Circle of Wildfire'],
  'Fighter':   ['Battle Master','Champion','Eldritch Knight','Arcane Archer','Cavalier','Samurai','Psi Warrior','Rune Knight'],
  'Monk':      ['Way of the Open Hand','Way of Shadow','Way of the Four Elements','Way of the Drunken Master','Way of the Kensei','Way of the Sun Soul','Way of Mercy','Way of the Astral Self'],
  'Paladin':   ['Oath of Devotion','Oath of the Ancients','Oath of Vengeance','Oath of Conquest','Oath of Redemption','Oath of Glory','Oath of the Watchers','Oathbreaker'],
  'Ranger':    ['Hunter','Beast Master','Gloom Stalker','Horizon Walker','Monster Slayer','Fey Wanderer','Swarmkeeper'],
  'Rogue':     ['Thief','Assassin','Arcane Trickster','Inquisitive','Mastermind','Scout','Swashbuckler','Phantom','Soulknife'],
  'Sorcerer':  ['Draconic Bloodline','Wild Magic','Divine Soul','Shadow Magic','Storm Sorcery','Aberrant Mind','Clockwork Soul'],
  'Warlock':   ['The Archfey','The Fiend','The Great Old One','The Hexblade','The Celestial','The Undying','The Fathomless','The Genie'],
  'Wizard':    ['School of Abjuration','School of Conjuration','School of Divination','School of Enchantment','School of Evocation','School of Illusion','School of Necromancy','School of Transmutation','Bladesinger','War Magic','Chronurgy Magic','Graviturgy Magic'],
}

const CLASS_HIT_DIE: Record<string, number> = {
  Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10,
  Bard: 8, Cleric: 8, Druid: 8, Monk: 8, Rogue: 8, Warlock: 8,
  Sorcerer: 6, Wizard: 6,
}

type RestType = 'short' | 'long'

const CLASS_RESOURCE: Record<string, { label: string; max: (level: number) => number; resetsOn: RestType }> = {
  Barbarian: { label: 'Rage',          max: (l) => l >= 20 ? 999 : l >= 17 ? 6 : l >= 12 ? 5 : l >= 6 ? 4 : l >= 3 ? 3 : 2, resetsOn: 'long' },
  Monk:      { label: 'Ki points',     max: (l) => l,                                                                     resetsOn: 'short' },
  Sorcerer:  { label: 'Sorcery points',max: (l) => l >= 2 ? l : 0,                                                        resetsOn: 'long' },
}

const SPELLCASTING_ABILITY: Record<string,string> = {
  Bard:'cha',Cleric:'wis',Druid:'wis',Paladin:'cha',Ranger:'wis',Sorcerer:'cha',Warlock:'cha',Wizard:'int',
}

const CANTRIPS_KNOWN: Record<string, number[]> = {
  Bard:     [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  Cleric:   [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
  Druid:    [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  Sorcerer: [4,4,4,5,5,5,5,5,5,6,6,6,6,6,6,6,6,6,6,6],
  Warlock:  [2,2,2,3,3,3,3,3,3,4,4,4,4,4,4,4,4,4,4,4],
  Wizard:   [3,3,3,4,4,4,4,4,4,5,5,5,5,5,5,5,5,5,5,5],
}

// "Known" casters — fixed spells known, no daily prepare/swap
const SPELLS_KNOWN: Record<string, number[]> = {
  Bard:     [4,5,6,7,8,9,10,11,12,14,14,15,15,16,18,19,19,20,22,22],
  Sorcerer: [2,3,4,5,6,7,8,9,10,11,12,12,13,13,14,14,15,15,15,15],
  Warlock:  [2,3,4,5,6,7,8,9,10,10,11,11,12,12,13,13,14,14,15,15],
  Ranger:   [0,2,3,3,4,4,5,6,6,7,7,8,9,9,10,10,11,11,11,11],
}
const KNOWN_CASTERS = new Set(Object.keys(SPELLS_KNOWN))

const SPELL_SLOTS: Record<number, number[]> = {
  1:[2,0,0,0,0,0,0,0,0], 2:[3,0,0,0,0,0,0,0,0], 3:[4,2,0,0,0,0,0,0,0],
  4:[4,3,0,0,0,0,0,0,0], 5:[4,3,2,0,0,0,0,0,0], 6:[4,3,3,0,0,0,0,0,0],
  7:[4,3,3,1,0,0,0,0,0], 8:[4,3,3,2,0,0,0,0,0], 9:[4,3,3,3,1,0,0,0,0],
  10:[4,3,3,3,2,0,0,0,0],11:[4,3,3,3,2,1,0,0,0],12:[4,3,3,3,2,1,0,0,0],
  13:[4,3,3,3,2,1,1,0,0],14:[4,3,3,3,2,1,1,0,0],15:[4,3,3,3,2,1,1,1,0],
  16:[4,3,3,3,2,1,1,1,0],17:[4,3,3,3,2,1,1,1,1],18:[4,3,3,3,3,1,1,1,1],
  19:[4,3,3,3,3,2,1,1,1],20:[4,3,3,3,3,2,2,1,1],
}

const NON_CASTERS = new Set(['Barbarian','Fighter','Monk','Rogue'])
const HALF_CASTERS = new Set(['Paladin','Ranger'])

const CLASS_SAVE_PROFS: Record<string, string[]> = {
  Barbarian:['str','con'], Bard:['dex','cha'], Cleric:['wis','cha'],
  Druid:['int','wis'], Fighter:['str','con'], Monk:['str','dex'],
  Paladin:['wis','cha'], Ranger:['str','dex'], Rogue:['dex','int'],
  Sorcerer:['con','cha'], Warlock:['wis','cha'], Wizard:['int','wis'],
}

const CLASS_FEATURES: Record<string, [number, string, string][]> = {
  Barbarian: [
    [1,'Rage','Bonus action. While raging: +2 damage (Str attacks), resistance to B/P/S damage. Ends if no attack/damage taken or you end it. Uses: 2 (scales with level).'],
    [1,'Unarmored Defense','AC = 10 + Dex mod + Con mod when not wearing armor.'],
    [2,'Reckless Attack','First attack with advantage. Attacks against you also have advantage until next turn.'],
    [2,'Danger Sense','Advantage on Dex saves against visible effects (traps, spells).'],
    [3,'Primal Path','Choose your subclass.'],
    [4,'ASI','Ability Score Improvement: +2 to one score or +1 to two scores.'],
    [5,'Extra Attack','Attack twice when you take the Attack action.'],
    [5,'Fast Movement','+10 ft speed when not wearing heavy armor.'],
    [7,'Feral Instinct','Advantage on initiative rolls. Can act normally when surprised if you enter rage.'],
    [9,'Brutal Critical','Roll one additional weapon damage die on a critical hit.'],
    [11,'Relentless Rage','If you drop to 0 HP while raging, make Con save (DC 10, +5 each use) to stay at 1 HP.'],
    [15,'Persistent Rage','Rage only ends early if you fall unconscious or choose to end it.'],
    [20,'Primal Champion','+4 Strength, +4 Constitution (max 24).'],
  ],
  Bard: [
    [1,'Spellcasting','Cha-based. You know 2 cantrips + 4 spells at L1; more as you level.'],
    [1,'Bardic Inspiration','Bonus action: a creature within 60 ft gains a Bardic Inspiration die (d6→d12). Add to one attack, ability check, or save within 10 min. Uses = Cha mod/long rest.'],
    [2,'Jack of All Trades','Add half your proficiency bonus (round down) to ability checks you lack proficiency in.'],
    [2,'Song of Rest','Allies who hear you during a short rest regain extra HP: d6 (L2), d8 (L9), d10 (L13), d12 (L17).'],
    [3,'Expertise','Double proficiency on 2 skills of your choice.'],
    [3,'Bard College','Choose your subclass.'],
    [4,'ASI','Ability Score Improvement.'],
    [5,'Font of Inspiration','Regain all Bardic Inspiration uses on a short rest.'],
    [6,'Countercharm','Action: until start of next turn, you and allies within 30 ft have advantage vs. frightened/charmed.'],
    [10,'Magical Secrets','Learn 2 spells from any class. Repeat at L14 and L18.'],
    [20,'Superior Inspiration','Regain 1 Bardic Inspiration when you roll initiative with none remaining.'],
  ],
  Cleric: [
    [1,'Spellcasting','Wis-based. Prepare Wis mod + cleric level spells each long rest.'],
    [1,'Divine Domain','Choose your subclass (domain). Grants domain spells and features.'],
    [2,'Channel Divinity','Use once per short rest. Turn Undead or use domain ability.'],
    [4,'ASI','Ability Score Improvement.'],
    [5,'Destroy Undead','Undead that fail Turn Undead save are destroyed if CR ≤ threshold (scales with level).'],
    [10,'Divine Intervention','Call on your deity. Roll d100; succeeds on ≤ cleric level. Recharges on long rest.'],
    [20,'Divine Intervention','Automatically succeeds. Recharges on long rest.'],
  ],
  Druid: [
    [1,'Druidic','You know Druidic, a secret druid language.'],
    [1,'Spellcasting','Wis-based. Prepare Wis mod + druid level spells each long rest.'],
    [2,'Wild Shape','Bonus action: transform into a beast (CR limits apply). 2 uses/short rest.'],
    [2,'Druid Circle','Choose your subclass.'],
    [4,'ASI','Ability Score Improvement.'],
    [10,'Beast Spells','Maintain concentration and perform verbal/somatic spell components while in Wild Shape.'],
    [18,'Timeless Body','Age 10× slower than normal. Immune to magical aging.'],
    [20,'Archdruid','Unlimited Wild Shape uses.'],
  ],
  Fighter: [
    [1,'Fighting Style','Choose: Archery (+2 ranged atk), Defense (+1 AC in armor), Dueling (+2 dmg one-handed), Great Weapon (reroll 1s/2s), Protection (impose disadv on adjacent attack), Two-Weapon (+ability mod to offhand).'],
    [1,'Second Wind','Bonus action: regain 1d10 + fighter level HP. Recharges on short rest.'],
    [2,'Action Surge','Take one additional action on your turn. Recharges on short rest (2 uses at L17).'],
    [3,'Martial Archetype','Choose your subclass.'],
    [4,'ASI','Ability Score Improvement.'],
    [5,'Extra Attack','Attack twice when you take the Attack action.'],
    [9,'Indomitable','Reroll a failed saving throw (must use new roll). 1/long rest; 2 at L13, 3 at L17.'],
    [11,'Extra Attack (2)','Attack three times when you take the Attack action.'],
    [20,'Extra Attack (3)','Attack four times when you take the Attack action.'],
  ],
  Monk: [
    [1,'Unarmored Defense','AC = 10 + Dex mod + Wis mod when not wearing armor or shield.'],
    [1,'Martial Arts','Use Dex for unarmed/monk weapon attacks. Unarmed die: d4 (L1), d6 (L5), d8 (L11), d10 (L17). Bonus action unarmed strike after Attack action.'],
    [2,'Ki','Ki points = monk level. Flurry of Blows (2 ki: 2 bonus unarmed strikes), Patient Defense (1 ki: Dodge), Step of the Wind (1 ki: Disengage or Dash + doubled jump).'],
    [2,'Unarmored Movement','+10 ft speed (scales: +15 at L6, +20 at L10, +25 at L14, +30 at L18).'],
    [3,'Monastic Tradition','Choose your subclass.'],
    [3,'Deflect Missiles','Reaction: reduce ranged weapon damage by 1d10 + Dex + monk level. If reduced to 0, catch and throw back (1 ki).'],
    [4,'Slow Fall','Reaction: reduce fall damage by 5 × monk level.'],
    [5,'Extra Attack','Attack twice when you take the Attack action.'],
    [5,'Stunning Strike','1 ki after hitting: target makes Con save or is stunned until end of your next turn.'],
    [6,'Ki-Empowered Strikes','Unarmed strikes count as magical for overcoming resistance.'],
    [7,'Evasion','No damage on successful Dex save (for half damage effects); half damage on fail.'],
    [14,'Diamond Soul','Proficiency in all saving throws. Spend 1 ki to reroll a failed save.'],
    [20,'Perfect Self','Regain 4 ki on initiative roll if you have 0 remaining.'],
  ],
  Paladin: [
    [1,'Divine Sense','Detect celestials, fiends, undead within 60 ft as an action. Uses = 1 + Cha mod/long rest.'],
    [1,'Lay on Hands','Pool of HP = paladin level × 5. Touch to restore HP, or spend 5 to cure disease/poison.'],
    [2,'Fighting Style','Choose: Defense, Dueling, Great Weapon, or Protection.'],
    [2,'Spellcasting','Cha-based. Prepare Cha mod + half paladin level (round down) spells.'],
    [2,'Divine Smite','When you hit a melee attack, expend a spell slot: 2d8 radiant (+1d8/slot level above 1st, max 5d8). +1d8 vs undead/fiends.'],
    [3,'Sacred Oath','Choose your subclass.'],
    [5,'Extra Attack','Attack twice when you take the Attack action.'],
    [6,'Aura of Protection','You and allies within 10 ft add Cha mod to saving throws (min +1). 20 ft at L18.'],
    [7,'Aura of Courage','You and allies within 10 ft can\'t be frightened. 20 ft at L18.'],
    [11,'Improved Divine Smite','All melee weapon attacks deal +1d8 radiant damage.'],
    [20,'Sacred Oath Capstone','Powerful oath-specific transformation (see subclass).'],
  ],
  Ranger: [
    [1,'Favored Enemy','Advantage on Survival to track and Int to recall info about chosen enemy type.'],
    [1,'Natural Explorer','Double proficiency on Int/Wis checks for chosen terrain type. Various travel benefits.'],
    [2,'Fighting Style','Choose: Archery, Defense, Dueling, or Two-Weapon.'],
    [2,'Spellcasting','Wis-based. Prepare Wis mod + half ranger level (round down) spells.'],
    [3,'Ranger Archetype','Choose your subclass.'],
    [3,'Primeval Awareness','Spend a spell slot: sense aberrations/celestials/dragons/elementals/fey/fiends/undead within 1 mile (6 miles in favored terrain) for 1 min/slot level.'],
    [5,'Extra Attack','Attack twice when you take the Attack action.'],
    [8,'Land\'s Stride','Nonmagical difficult terrain costs no extra movement. Advantage on saves vs. magical plants.'],
    [14,'Vanish','Use Hide as a bonus action. Can\'t be tracked by nonmagical means (leave no tracks).'],
    [20,'Foe Slayer','Once per turn, add Wis mod to attack or damage roll against a favored enemy.'],
  ],
  Rogue: [
    [1,'Expertise','Double proficiency on 2 skills (or 1 skill + Thieves\' Tools).'],
    [1,'Sneak Attack','+1d6 damage when you have advantage or an ally is adjacent to target (no disadvantage). Scales: +1d6 every 2 levels.'],
    [1,'Thieves\' Cant','Secret language/code used by criminals and rogues.'],
    [2,'Cunning Action','Bonus action: Dash, Disengage, or Hide.'],
    [3,'Roguish Archetype','Choose your subclass.'],
    [4,'ASI','Ability Score Improvement.'],
    [5,'Uncanny Dodge','Reaction: halve the damage from one attack you can see.'],
    [7,'Evasion','No damage on successful Dex save; half damage on fail.'],
    [11,'Reliable Talent','Minimum roll of 10 on any ability check you\'re proficient in.'],
    [15,'Slippery Mind','Gain proficiency in Wisdom saving throws.'],
    [18,'Elusive','Attackers never have advantage on attack rolls against you.'],
    [20,'Stroke of Luck','If you miss an attack or fail an ability check, treat it as a hit/20. Recharges on short rest.'],
  ],
  Sorcerer: [
    [1,'Spellcasting','Cha-based. You know a set number of spells (4 at L1, scaling up).'],
    [1,'Sorcerous Origin','Choose your subclass.'],
    [2,'Font of Magic','Sorcery points = sorcerer level. Flexible Casting: convert points ↔ spell slots.'],
    [3,'Metamagic','Choose 2 options (more at L10, L17): Careful, Distant, Empowered, Extended, Heightened, Quickened, Seeking, Subtle, Twinned.'],
    [4,'ASI','Ability Score Improvement.'],
    [20,'Sorcerous Restoration','Regain 4 sorcery points on a short rest.'],
  ],
  Warlock: [
    [1,'Otherworldly Patron','Choose your subclass (patron).'],
    [1,'Pact Magic','Cha-based. Spell slots recharge on short rest. All slots are at your highest available level.'],
    [2,'Eldritch Invocations','Choose 2 invocations from the list; gain more as you level.'],
    [3,'Pact Boon','Choose Pact of the Blade (weapon), Chain (familiar), or Tome (book of spells).'],
    [4,'ASI','Ability Score Improvement.'],
    [11,'Mystic Arcanum','Cast one 6th-level spell once per long rest without a slot (7th at L13, 8th at L15, 9th at L17).'],
    [20,'Eldritch Master','Spend 1 minute entreating your patron to regain all Pact Magic slots. 1/long rest.'],
  ],
  Wizard: [
    [1,'Spellcasting','Int-based. Spellbook starts with 6 spells; add 2 per level. Prepare Int mod + wizard level spells.'],
    [1,'Arcane Recovery','Short rest: recover spell slots totaling ≤ half wizard level (rounded up, max 5th level). 1/day.'],
    [2,'Arcane Tradition','Choose your subclass (school of magic).'],
    [4,'ASI','Ability Score Improvement.'],
    [18,'Spell Mastery','Choose one 1st-level and one 2nd-level spell; cast each at their lowest level without expending a slot.'],
    [20,'Signature Spells','Choose two 3rd-level spells; cast each once without a slot per short rest.'],
  ],
}

const RACE_TRAITS: Record<string, string> = {
  'Astral Elf':      '+2/+1 to ability scores of choice. Speed 30 ft. Darkvision 60 ft. Immune to magical sleep. Advantage vs. charmed. Sacred Flame cantrip (at-will). Misty Step (at level 5, 1/long rest). Vampiric Gaze: Charm Person 1/short rest. Vampire\'s Bite: deal+regain temp HP (Prof uses/long rest).',
  'Dark Elf (Drow)': '+2 Dex, +1 Cha. Speed 30 ft. Darkvision 120 ft. Sunlight Sensitivity. Immune to magical sleep. Advantage vs. charmed. Perception proficiency. Drow Magic: Dancing Lights (cantrip), Faerie Fire 1/long rest (L3), Darkness 1/long rest (L5).',
  'Dragonborn':      '+2 Str, +1 Cha. Speed 30 ft. Choose a draconic ancestry type (determines breath weapon damage type and saving throw). Breath Weapon: 2d6 damage in a 15 ft cone or 30 ft line, Con save for half. Damage Resistance matching your ancestry.',
  'Dwarf (Hill)':    '+2 Con, +1 Wis. Speed 25 ft (not reduced by heavy armor). Darkvision 60 ft. Dwarven Resilience: advantage on saves vs. poison, resistance to poison. Weapon proficiency: battleaxe, handaxe, warhammer, light hammer. Stonecunning: double proficiency on History checks for stonework. Tool proficiency of choice.',
  'Dwarf (Mountain)':'+2 Str, +2 Con. Speed 25 ft. Darkvision 60 ft. Same poison resistance as Hill Dwarf. Light + medium armor proficiency. Weapon proficiency: battleaxe, handaxe, warhammer, light hammer. Stonecunning.',
  'Elf (High)':      '+2 Dex, +1 Int. Speed 30 ft. Darkvision 60 ft. Immune to magical sleep. Advantage vs. charmed. Perception proficiency. Trance (4 hr long rest). One wizard cantrip (Int-based). Proficiency: longsword, shortsword, longbow, shortbow. One extra language.',
  'Fairy':           '+2/+1 to ability scores of choice. Speed 30 ft, Fly 30 ft. Darkvision 60 ft. Fairy Magic: Druidcraft cantrip (at-will). Faerie Fire and Enlarge/Reduce 1/long rest each (Int/Wis/Cha spellcasting).',
  'Gnome (Forest)':  '+1 Dex, +2 Int. Speed 25 ft. Darkvision 60 ft. Gnome Cunning: advantage on Int/Wis/Cha saves vs. magic. Natural Illusionist: Minor Illusion cantrip (Int). Speak with Small Beasts.',
  'Gnome (Rock)':    '+1 Con, +2 Int. Speed 25 ft. Darkvision 60 ft. Gnome Cunning. Artificer\'s Lore: double proficiency on magic item History checks. Tinker: create tiny clockwork devices.',
  'Half-Elf':        '+2 Cha, +1 to two other ability scores. Speed 30 ft. Darkvision 60 ft. Fey Ancestry: advantage vs. charmed, immune to magical sleep. Two skill proficiencies of your choice.',
  'Half-Orc':        '+2 Str, +1 Con. Speed 30 ft. Darkvision 60 ft. Intimidation proficiency. Relentless Endurance: when reduced to 0 HP, drop to 1 HP instead (1/long rest). Savage Attacks: roll one extra damage die on melee critical hits.',
  'Halfling (Lightfoot)': '+2 Dex, +1 Cha. Speed 25 ft. Lucky: reroll 1s on attack rolls, ability checks, saving throws. Brave: advantage vs. frightened. Nimbleness: move through the space of larger creatures. Naturally Stealthy: hide behind creatures at least one size larger.',
  'Halfling (Stout)': '+2 Dex, +1 Con. Speed 25 ft. Lucky. Brave. Nimbleness. Stout Resilience: advantage vs. poison, resistance to poison.',
  'Human':           '+1 to all six ability scores. Speed 30 ft. One extra language of your choice.',
  'Human (Variant)': '+1 to two ability scores of your choice. Speed 30 ft. One skill proficiency of your choice. One feat of your choice. One extra language.',
  'Tiefling':        '+1 Int, +2 Cha. Speed 30 ft. Darkvision 60 ft. Hellish Resistance: fire resistance. Infernal Legacy: Thaumaturgy cantrip; Hellish Rebuke (L3, 1/long rest); Darkness (L5, 1/long rest). Cha spellcasting.',
  'Wood Elf':        '+2 Dex, +1 Wis. Speed 35 ft. Darkvision 60 ft. Immune to magical sleep. Advantage vs. charmed. Perception proficiency. Trance. Proficiency: longsword, shortsword, longbow, shortbow. Mask of the Wild: hide when lightly obscured by natural phenomena.',
  'Custom Lineage':  '+2 to one ability score of your choice. Small or Medium size. One feat of your choice. Either darkvision 60 ft OR proficiency in one skill. One extra language.',
}

const FEATS = [
  { name:'Alert',          desc:'+5 initiative. Can\'t be surprised. Hidden creatures don\'t gain advantage on attacks vs. you.', asi: null },
  { name:'Actor',          desc:'+1 Charisma (max 20). Advantage on Deception/Performance when impersonating. Mimic voices.', asi: { amount: 1, choose: ['cha'] } },
  { name:'Athlete',        desc:'+1 Str or Dex. Stand up uses only 5 ft movement. Climb at full speed. Running jump with 5 ft run-up.', asi: { amount: 1, choose: ['str', 'dex'] } },
  { name:'Charger',        desc:'After Dash, bonus attack (+5 damage) or shove 10 ft.', asi: null },
  { name:'Crossbow Expert',desc:'Ignore loading. No disadvantage in melee. Bonus hand crossbow attack after Attack action.', asi: null },
  { name:'Defensive Duelist', desc:'Req: Dex 13. Reaction with finesse weapon: add proficiency bonus to AC against one attack.', asi: null },
  { name:'Dual Wielder',   desc:'+1 AC. Two-weapon fight with non-light weapons. Draw two weapons at once.', asi: null },
  { name:'Dungeon Delver', desc:'Advantage on Perception/Investigation for secret doors. Advantage on trap saves. Resistance to trap damage.', asi: null },
  { name:'Durable',        desc:'+1 Constitution (max 20). Min roll on Hit Dice = twice Con mod.', asi: { amount: 1, choose: ['con'] } },
  { name:'Elemental Adept',desc:'Req: spellcasting. Choose damage type; spells ignore resistance, treat 1s as 2s on damage dice.', asi: null },
  { name:'Fey Touched',    desc:'+1 Int, Wis, or Cha. Learn Misty Step + one 1st-level divination or enchantment spell. Cast each free 1/long rest.', asi: { amount: 1, choose: ['int', 'wis', 'cha'] } },
  { name:'Great Weapon Master', desc:'Critical or kill → bonus attack. Option: −5 attack for +10 damage.', asi: null },
  { name:'Healer',         desc:'Healer\'s Kit: stabilize (target wakes at 1 HP). Heal 1d6+4+HD HP once per target per rest.', asi: null },
  { name:'Heavy Armor Master', desc:'Req: heavy armor prof. +1 Strength. B/P/S damage reduced by 3 while in heavy armor.', asi: null },
  { name:'Inspiring Leader', desc:'Req: Cha 13. 10-min speech: up to 6 allies gain temp HP = level + Cha mod.', asi: null },
  { name:'Lucky',          desc:'3 luck points/long rest. Spend to roll extra d20 on attack/check/save or give enemy disadvantage.', asi: null },
  { name:'Mage Slayer',    desc:'Reaction: attack spellcaster after they cast in melee. Advantage on saves vs. adjacent spellcasters. Concentration disadvantage after your attacks.', asi: null },
  { name:'Magic Initiate', desc:'Choose a class: learn 2 cantrips + one 1st-level spell (1/long rest free).', asi: null },
  { name:'Metamagic Adept',desc:'Req: spellcasting. Learn 2 Metamagic options. Gain 2 sorcery points.', asi: null },
  { name:'Mobile',         desc:'+10 ft speed. Dash ignores difficult terrain. No opportunity attack from creatures you attack (hit or miss).', asi: null },
  { name:'Observant',      desc:'+1 Int or Wis. +5 passive Perception and Investigation. Lip reading.', asi: { amount: 1, choose: ['int', 'wis'] } },
  { name:'Polearm Master', desc:'Bonus attack with butt end (1d4). Opportunity attack when creature enters your reach.', asi: null },
  { name:'Resilient',      desc:'Choose ability score: +1 (max 20), proficiency in that saving throw.', asi: { amount: 1, choose: ABILITIES } },
  { name:'Sentinel',       desc:'Opportunity attack reduces speed to 0. No Disengage from opportunity attacks. Reaction attack when adjacent creature attacks someone else.', asi: null },
  { name:'Shadow Touched', desc:'+1 Int, Wis, or Cha. Learn Invisibility + one 1st-level illusion or necromancy spell. Cast each free 1/long rest.', asi: { amount: 1, choose: ['int', 'wis', 'cha'] } },
  { name:'Sharpshooter',   desc:'No disadvantage at long range. Ignore half/three-quarters cover. Option: −5 attack for +10 damage.', asi: null },
  { name:'Shield Master',  desc:'Bonus shove after Attack. Add shield bonus to Dex saves targeting only you. No damage on successful Dex save.', asi: null },
  { name:'Silvery Barbs',  desc:'Req: Bard/Sorcerer/Wizard. Reaction: force reroll, take lower result; give another creature advantage on next roll.', asi: null },
  { name:'Skilled',        desc:'Proficiency in any 3 skills or tools.', asi: null },
  { name:'Telekinetic',    desc:'+1 Int, Wis, or Cha. Mage Hand (invisible). Bonus action: push/pull creature 5 ft.', asi: { amount: 1, choose: ['int', 'wis', 'cha'] } },
  { name:'Telepathic',     desc:'+1 Int, Wis, or Cha. Telepathic speech within 60 ft. Detect Thoughts 1/long rest free.', asi: { amount: 1, choose: ['int', 'wis', 'cha'] } },
  { name:'Tough',          desc:'HP max increases by 2 per level (retroactive).', asi: null },
  { name:'War Caster',     desc:'Req: spellcasting. Advantage on concentration saves. Somatic components with full hands. Opportunity attack can be a spell.', asi: null },
  { name:'Weapon Master',  desc:'+1 Str or Dex. Proficiency with 4 weapons of your choice.', asi: { amount: 1, choose: ['str', 'dex'] } },
]

const BACKGROUNDS: Record<string, {
  skills: string[]
  tools: string
  languages: string
  equipment: string
  feature: string
  featureDesc: string
  trait: string
  ideal: string
  bond: string
  flaw: string
}> = {
  'Acolyte': {
    skills: ['Insight','Religion'],
    tools: 'None',
    languages: 'Two of your choice',
    equipment: 'Holy symbol, prayer book or prayer wheel, 5 sticks of incense, vestments, common clothes, 15 gp',
    feature: 'Shelter of the Faithful',
    featureDesc: 'You and your companions can receive free healing and care at temples of your faith. You have ties to a specific temple and can call on the priests there for assistance.',
    trait: 'I idolize a hero of my faith.',
    ideal: 'Tradition. The ancient traditions must be preserved.',
    bond: 'I will someday get revenge on the corrupt temple hierarchy.',
    flaw: 'I am inflexible in my thinking.',
  },
  'Charlatan': {
    skills: ['Deception','Sleight of Hand'],
    tools: 'Disguise kit, forgery kit',
    languages: 'None',
    equipment: 'Fine clothes, disguise kit, tools of the con of your choice, 15 gp',
    feature: 'False Identity',
    featureDesc: 'You have created a second identity including documentation, established acquaintances, and disguises. You can also forge documents as long as you have seen similar ones.',
    trait: 'I fall in and out of love easily.',
    ideal: 'Independence. I am a free spirit — no one tells me what to do.',
    bond: 'I fleeced the wrong person and must work to repay my debt.',
    flaw: 'I can\'t resist a pretty face.',
  },
  'Criminal': {
    skills: ['Deception','Stealth'],
    tools: 'One type of gaming set, thieves\' tools',
    languages: 'None',
    equipment: 'Crowbar, dark common clothes with a hood, 15 gp',
    feature: 'Criminal Contact',
    featureDesc: 'You have a reliable and trustworthy contact who acts as your liaison to a network of other criminals. You know how to get messages to and from your contact.',
    trait: 'I always have a plan for when things go wrong.',
    ideal: 'Freedom. Chains are meant to be broken.',
    bond: 'I\'m trying to pay off an old debt I owe to a generous benefactor.',
    flaw: 'When I see something valuable, I can\'t think about anything but how to steal it.',
  },
  'Entertainer': {
    skills: ['Acrobatics','Performance'],
    tools: 'Disguise kit, one type of musical instrument',
    languages: 'None',
    equipment: 'Musical instrument, favor of admirer, costume, 15 gp',
    feature: 'By Popular Demand',
    featureDesc: 'You can always find a place to perform, and receive free lodging and food of modest quality. Your performance makes you something of a local figure.',
    trait: 'I know a story relevant to almost every situation.',
    ideal: 'Creativity. The world needs new ideas and bold action.',
    bond: 'I want to be famous, whatever it takes.',
    flaw: 'I have trouble keeping my true feelings hidden.',
  },
  'Folk Hero': {
    skills: ['Animal Handling','Survival'],
    tools: 'One type of artisan\'s tools, vehicles (land)',
    languages: 'None',
    equipment: 'Artisan\'s tools, shovel, iron pot, common clothes, 10 gp',
    feature: 'Rustic Hospitality',
    featureDesc: 'Since you come from the common folk, you fit in among them with ease. You can find a place to hide, rest, or recuperate among commoners, unless you\'ve shown yourself to be a danger to them.',
    trait: 'I judge people by their actions, not their words.',
    ideal: 'Respect. People deserve to be treated with dignity.',
    bond: 'I protect those who cannot protect themselves.',
    flaw: 'I\'m convinced of the significance of my destiny and blind to my shortcomings.',
  },
  'Guild Artisan': {
    skills: ['Insight','Persuasion'],
    tools: 'One type of artisan\'s tools',
    languages: 'One of your choice',
    equipment: 'Artisan\'s tools, letter of introduction from guild, traveler\'s clothes, 15 gp',
    feature: 'Guild Membership',
    featureDesc: 'You have the support of your guild. Fellow members provide lodging and food, and can help you find work. In an emergency, the guild may provide legal assistance.',
    trait: 'I believe that anything worth doing is worth doing right.',
    ideal: 'Community. It is the duty of all to strengthen the bonds of community.',
    bond: 'The workshop where I apprenticed belongs to my family.',
    flaw: 'I\'ll do anything to get my hands on something rare or priceless.',
  },
  'Hermit': {
    skills: ['Medicine','Religion'],
    tools: 'Herbalism kit',
    languages: 'One of your choice',
    equipment: 'Scroll case with notes, winter blanket, common clothes, herbalism kit, 5 gp',
    feature: 'Discovery',
    featureDesc: 'The quiet seclusion of your extended hermitage gave you access to a unique and powerful discovery — a secret of nature, the multiverse, the gods, or the forces that drive them.',
    trait: 'I\'ve been isolated for so long that I rarely speak, preferring gestures and expressions.',
    ideal: 'Greater Good. My gifts are meant to be shared with all.',
    bond: 'I entered seclusion to hide from those who might still be hunting me.',
    flaw: 'I like keeping secrets and won\'t share them with anyone.',
  },
  'Noble': {
    skills: ['History','Persuasion'],
    tools: 'One type of gaming set',
    languages: 'One of your choice',
    equipment: 'Fine clothes, signet ring, scroll of pedigree, purse with 25 gp',
    feature: 'Position of Privilege',
    featureDesc: 'Thanks to your noble birth, people are inclined to think the best of you. You are welcome in high society, and common folk make every effort to accommodate you.',
    trait: 'My favor, once lost, is lost forever.',
    ideal: 'Responsibility. It is my duty to respect the authority of those above me.',
    bond: 'I will face any challenge to win the approval of my family.',
    flaw: 'I secretly believe that everyone is beneath me.',
  },
  'Outlander': {
    skills: ['Athletics','Survival'],
    tools: 'One type of musical instrument',
    languages: 'One of your choice',
    equipment: 'Staff, hunting trap, trophy from an animal, traveler\'s clothes, 10 gp',
    feature: 'Wanderer',
    featureDesc: 'You have an excellent memory for maps and geography, and can always recall the general layout of terrain. You can find food and fresh water for yourself and up to 5 others each day.',
    trait: 'I watch over my friends as if they were a litter of newborn pups.',
    ideal: 'Change. Life is like the seasons — in constant change.',
    bond: 'My family, clan, or tribe is the most important thing in my life.',
    flaw: 'I am slow to trust members of other races.',
  },
  'Sage': {
    skills: ['Arcana','History'],
    tools: 'None',
    languages: 'Two of your choice',
    equipment: 'Bottle of ink, quill, small knife, letter from dead colleague, common clothes, 10 gp',
    feature: 'Researcher',
    featureDesc: 'When you attempt to learn or recall a piece of lore, if you don\'t know the information, you often know where and from whom you can obtain it.',
    trait: 'I use polysyllabic words that convey the impression of great erudition.',
    ideal: 'Knowledge. The path to power and self-improvement is through knowledge.',
    bond: 'I have an ancient text that holds secrets that must not fall into the wrong hands.',
    flaw: 'I am easily distracted by the promise of information.',
  },
  'Sailor': {
    skills: ['Athletics','Perception'],
    tools: 'Navigator\'s tools, vehicles (water)',
    languages: 'None',
    equipment: 'Belaying pin (club), 50 ft silk rope, lucky charm, common clothes, 10 gp',
    feature: 'Ship\'s Passage',
    featureDesc: 'When you need to, you can secure free passage on a sailing ship for yourself and companions in exchange for working during the voyage.',
    trait: 'My friends know they can rely on me, no matter what.',
    ideal: 'Respect. The thing that keeps a ship together is respect for the captain.',
    bond: 'I\'ll always remember my first ship.',
    flaw: 'Once someone questions my courage, I never back down.',
  },
  'Soldier': {
    skills: ['Athletics','Intimidation'],
    tools: 'One type of gaming set, vehicles (land)',
    languages: 'None',
    equipment: 'Insignia of rank, trophy from fallen enemy, gaming set, common clothes, 10 gp',
    feature: 'Military Rank',
    featureDesc: 'You have a military rank. Soldiers loyal to your former military organization still recognize your authority, and they will defer to you if they are of a lower rank.',
    trait: 'I can stare down a hell hound without flinching.',
    ideal: 'Greater Good. Our lot is to lay down our lives in defense of others.',
    bond: 'I fight for those who cannot fight for themselves.',
    flaw: 'I have little respect for those who are not a proven warrior.',
  },
  'Urchin': {
    skills: ['Sleight of Hand','Stealth'],
    tools: 'Disguise kit, thieves\' tools',
    languages: 'None',
    equipment: 'Small knife, map of home city, pet mouse, token from parents, common clothes, 10 gp',
    feature: 'City Secrets',
    featureDesc: 'You know the secret patterns and flows to cities and can find passages through the urban sprawl that others would miss. You can travel twice the normal speed.',
    trait: 'I hide scraps of food and trinkets away in my pockets.',
    ideal: 'Community. We have to take care of each other.',
    bond: 'I owe a debt I can never repay to the person who took pity on me.',
    flaw: 'It\'s not stealing if I need it more than someone else.',
  },
  // TCoE backgrounds
  'City Watch': {
    skills: ['Athletics','Insight'],
    tools: 'None',
    languages: 'Two of your choice',
    equipment: 'Uniform of your organization, horn, manacles, 10 gp',
    feature: 'Watcher\'s Eye',
    featureDesc: 'Your experience in enforcing the law lets you identify local law enforcement quickly. You can find the local watch, guards, or officers in any settlement.',
    trait: 'I\'m always polite and respectful.',
    ideal: 'Nation. My city, nation, or people are all that matter.',
    bond: 'I worked hard to achieve my position and I\'ll defend it.',
    flaw: 'I have a weakness for the vices of the city.',
  },
  'Clan Crafter': {
    skills: ['History','Insight'],
    tools: 'One type of artisan\'s tools',
    languages: 'Dwarvish or one other',
    equipment: 'Artisan\'s tools, maker\'s mark chisel, traveler\'s clothes, 15 gp',
    feature: 'Respect of the Stout Folk',
    featureDesc: 'You always have free lodging and food available in any community with dwarves, as long as you have not shown yourself to be a danger to them.',
    trait: 'I take my time when crafting — quality over speed.',
    ideal: 'Tradition. Clan traditions must be preserved and upheld.',
    bond: 'My tools are sacred to me; I would rather die than part with them.',
    flaw: 'I\'m horribly jealous of anyone with better tools.',
  },
  'Cloistered Scholar': {
    skills: ['History', 'One from Arcana, Nature, or Religion'],
    tools: 'None',
    languages: 'Two of your choice',
    equipment: 'Reference book, writing kit, borrowed book, common clothes, 10 gp',
    feature: 'Library Access',
    featureDesc: 'You have free access to most libraries and can obtain assistance from the scholars there. You know how to navigate academic bureaucracy.',
    trait: 'I\'ve read so many books that I can quote them in any situation.',
    ideal: 'Knowledge. Learning is its own reward.',
    bond: 'My life\'s work is a series of tomes related to my field.',
    flaw: 'I am dismissive of those who aren\'t as educated as I am.',
  },
  'Courtier': {
    skills: ['Insight','Persuasion'],
    tools: 'None',
    languages: 'Two of your choice',
    equipment: 'Fine clothes, 5 gp',
    feature: 'Court Functionary',
    featureDesc: 'Your knowledge of how bureaucracies function lets you gain access to the records and inner workings of any noble court.',
    trait: 'I believe everyone has a hidden agenda and I constantly look for it.',
    ideal: 'Community. I strive to ensure that everyone benefits from my actions.',
    bond: 'I hope to serve a great leader.',
    flaw: 'I have an insatiable desire for carnal pleasures.',
  },
  'Far Traveler': {
    skills: ['Insight','Perception'],
    tools: 'One musical instrument or gaming set from your homeland',
    languages: 'One of your choice',
    equipment: 'Traveler\'s clothes, trinket from homeland, 15 gp',
    feature: 'All Eyes on You',
    featureDesc: 'Your accent, mannerisms, and clothing all mark you as foreign. Curious folk will show interest in you and help you in exchange for news of distant lands.',
    trait: 'I have different assumptions about personal space and boundaries.',
    ideal: 'Open. I have much to learn from the kindly folk I meet.',
    bond: 'I am homesick and long for the familiar sights of my homeland.',
    flaw: 'I have a weakness for the exotic, even if it causes me trouble.',
  },
  'Haunted One': {
    skills: ['Choose two from Arcana, Investigation, Religion, or Survival'],
    tools: 'None',
    languages: 'One exotic language (Abyssal, Celestial, Deep Speech, Draconic, Infernal, Primordial, Sylvan, or Undercommon)',
    equipment: 'Monster hunter\'s pack, dark common clothes, 1 sp',
    feature: 'Heart of Darkness',
    featureDesc: 'Those who look into your eyes can see that you have faced unimaginable horror and survived. Common folk make way for you; they sense the darkness in you.',
    trait: 'I don\'t talk about the thing that torments me.',
    ideal: 'I try to help those in need, no matter what the personal cost.',
    bond: 'I keep my monstrous nature a secret as best I can.',
    flaw: 'I have certain phobias rooted in my harrowing experience.',
  },
  'Inheritor': {
    skills: ['Survival', 'One from Arcana, History, or Religion'],
    tools: 'Your choice of a gaming set or a musical instrument',
    languages: 'None',
    equipment: 'Inheritance item, traveler\'s clothes, any gear related to your inheritance, 15 gp',
    feature: 'Inheritance',
    featureDesc: 'You inherit something of great value — a document, a weapon, a piece of jewelry — that carries a great responsibility or secret.',
    trait: 'I have a strong sense of fairness and always try to find the most equitable solution.',
    ideal: 'Responsibility. I must care for what has been entrusted to me.',
    bond: 'My inheritance is the most important thing in my life.',
    flaw: 'I am oblivious to the obvious.',
  },
  'Knight of the Order': {
    skills: ['Persuasion', 'One from Arcana, History, Nature, or Religion'],
    tools: 'One type of gaming set or musical instrument',
    languages: 'One of your choice',
    equipment: 'Traveler\'s clothes, signet of your order, 10 gp',
    feature: 'Knightly Regard',
    featureDesc: 'You receive shelter and succor from members of your knightly order and those who are sympathetic to its aims.',
    trait: 'I\'m still trying to live up to the example set by my order\'s founder.',
    ideal: 'Responsibility. I do what I must and accept the consequences.',
    bond: 'I\'ll never forget the crushing defeat my order suffered, or the enemies who dealt it.',
    flaw: 'I\'m too quick to assume that solutions involve violence.',
  },
  'Mercenary Veteran': {
    skills: ['Athletics','Persuasion'],
    tools: 'One type of gaming set, vehicles (land)',
    languages: 'None',
    equipment: 'Uniform of your company, insignia of your rank, gaming set, 10 gp',
    feature: 'Mercenary Life',
    featureDesc: 'You know the mercenary life as only someone who has lived it can. You are able to identify mercenary companies and know their reputations.',
    trait: 'I\'m used to hard work and am slow to quit.',
    ideal: 'Coin. I\'m only in it for the money.',
    bond: 'My honor is my life.',
    flaw: 'I have a gambling problem.',
  },
  'Urban Bounty Hunter': {
    skills: ['Choose two from Deception, Insight, Persuasion, or Stealth'],
    tools: 'Two from thieves\' tools, disguise kit, or one gaming set',
    languages: 'None',
    equipment: 'A set of clothes appropriate to your duties and a pouch containing 20 gp',
    feature: 'Ear to the Ground',
    featureDesc: 'You are in frequent contact with people in the segment of society that your chosen quarries move through. You can gather information about their whereabouts.',
    trait: 'I always have a plan for when things go wrong.',
    ideal: 'Greater Good. I help people who help themselves.',
    bond: 'I have a client who means a great deal to me.',
    flaw: 'I have a weakness for a certain vice.',
  },
  'Uthgardt Tribe Member': {
    skills: ['Athletics','Survival'],
    tools: 'One type of musical instrument or artisan\'s tools',
    languages: 'One of your choice',
    equipment: 'Hunting trap, totemic token, traveler\'s clothes, 10 gp',
    feature: 'Uthgardt Heritage',
    featureDesc: 'You have excellent knowledge of your tribe\'s territory and can find twice the normal amount of food when foraging. You are also familiar with the sacred sites of your tribe.',
    trait: 'I\'m driven by a wanderlust that led me away from home.',
    ideal: 'Change. The world is in need of new ideas and bold action.',
    bond: 'My tribe is the most important thing in my life.',
    flaw: 'I follow orders even if I think they\'re wrong.',
  },
  'Waterdhavian Noble': {
    skills: ['History','Persuasion'],
    tools: 'One type of gaming set or musical instrument',
    languages: 'One of your choice',
    equipment: 'Fine clothes, signet ring, scroll of pedigree, skin of fine zzar, 20 gp',
    feature: 'Kept in Style',
    featureDesc: 'While in Waterdeep or elsewhere, if in a city of similar size, you can maintain a comfortable lifestyle for free, as your family\'s name smooths the way.',
    trait: 'I take great pains to always look my best.',
    ideal: 'Responsibility. It is my duty to respect the authority of those above me.',
    bond: 'My house\'s alliance with another noble family must be sustained.',
    flaw: 'I hide a truly scandalous secret.',
  },
}

const CLASS_SKILL_CHOICES: Record<string, { count: number; options: string[] }> = {
  Barbarian: { count: 2, options: ['Animal Handling','Athletics','Intimidation','Nature','Perception','Survival'] },
  Bard:      { count: 3, options: ['Acrobatics','Animal Handling','Arcana','Athletics','Deception','History','Insight','Intimidation','Investigation','Medicine','Nature','Perception','Performance','Persuasion','Religion','Sleight of Hand','Stealth','Survival'] },
  Cleric:    { count: 2, options: ['History','Insight','Medicine','Persuasion','Religion'] },
  Druid:     { count: 2, options: ['Arcana','Animal Handling','Insight','Medicine','Nature','Perception','Religion','Survival'] },
  Fighter:   { count: 2, options: ['Acrobatics','Animal Handling','Athletics','History','Insight','Intimidation','Perception','Survival'] },
  Monk:      { count: 2, options: ['Acrobatics','Athletics','History','Insight','Religion','Stealth'] },
  Paladin:   { count: 2, options: ['Athletics','Insight','Intimidation','Medicine','Persuasion','Religion'] },
  Ranger:    { count: 3, options: ['Animal Handling','Athletics','Insight','Investigation','Nature','Perception','Stealth','Survival'] },
  Rogue:     { count: 4, options: ['Acrobatics','Athletics','Deception','Insight','Intimidation','Investigation','Perception','Performance','Persuasion','Sleight of Hand','Stealth'] },
  Sorcerer:  { count: 2, options: ['Arcana','Deception','Insight','Intimidation','Persuasion','Religion'] },
  Warlock:   { count: 2, options: ['Arcana','Deception','History','Intimidation','Investigation','Nature','Religion'] },
  Wizard:    { count: 2, options: ['Arcana','History','Insight','Investigation','Medicine','Religion'] },
}

// ── Helpers ─────────────────────────────────────────────────

function getMod(score: number) { return Math.floor((score - 10) / 2) }
function modStr(n: number) { return n >= 0 ? `+${n}` : `${n}` }
function profBonus(level: number) { return Math.ceil(level / 4) + 1 }
function computeArmorClass(equipped: EquippedItem[], dexMod: number): number | null {
  const armorPieces = equipped.filter(e => e.detail?.armor_class)
  if (armorPieces.length === 0) return null

  const shields = armorPieces.filter(e => e.detail?.armor_category === 'Shield')
  const bodyArmor = armorPieces.filter(e => e.detail?.armor_category && e.detail.armor_category !== 'Shield')

  let base: number
  if (bodyArmor.length === 0) {
    base = 10 + dexMod
  } else {
    // if more than one body armor is equipped, just use the highest base (shouldn't normally happen)
    const piece = bodyArmor.reduce((a, b) => (b.detail!.armor_class!.base > a.detail!.armor_class!.base ? b : a))
    const ac = piece.detail!.armor_class!
    const dexContribution = ac.dex_bonus
      ? (ac.max_bonus != null ? Math.min(dexMod, ac.max_bonus) : dexMod)
      : 0
    base = ac.base + Math.max(dexContribution, 0)
  }

  const shieldBonus = shields.reduce((sum, s) => sum + (s.detail?.armor_class?.base ?? 0), 0)
  return base + shieldBonus
}

function weaponAbilityMod(detail: ItemDetail, stats: Character['stats']): number {
  const props = detail.properties?.map(p => p.name.toLowerCase()) ?? []
  const isFinesse = props.includes('finesse')
  const isRanged = detail.weapon_category === 'Ranged' || !!detail.range
  const strMod = getMod(stats.str ?? 10)
  const dexMod = getMod(stats.dex ?? 10)
  if (isFinesse) return Math.max(strMod, dexMod)
  if (isRanged) return dexMod
  return strMod
}

interface WeaponAttack {
  index: string
  name: string
  atkBonus: number
  damageDice: string
  damageType: string
  damageMod: number
  properties: string[]
  isRanged: boolean
  isVersatile: boolean
  twoHanded: boolean
}

function computeWeaponAttacks(equipped: EquippedItem[], stats: Character['stats'], pb: number): WeaponAttack[] {
  return equipped
    .filter(e => e.detail?.damage)
    .map(e => {
      const d = e.detail!
      const mod = weaponAbilityMod(d, stats)
      const isVersatile = d.properties?.some(p => p.name.toLowerCase() === 'versatile') && !!d.two_handed_damage
      const useTwoHanded = e.twoHanded && isVersatile
      const dmg = useTwoHanded ? d.two_handed_damage! : d.damage!
      return {
        index: e.index,
        name: e.name,
        atkBonus: pb + mod,
        damageDice: dmg.damage_dice,
        damageType: dmg.damage_type.name,
        damageMod: mod,
        properties: d.properties?.map(p => p.name) ?? [],
        isRanged: d.weapon_category === 'Ranged' || !!d.range,
        isVersatile,
        twoHanded: !!useTwoHanded,
      }
    }
  )
}

const inputCls = 'w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors'
const selectCls = 'w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors'

type Tab = 'core' | 'combat' | 'skills' | 'features' | 'spells' | 'notes' | 'equipment'

// ── Component ────────────────────────────────────────────────

export default function CharacterSheetClient({ campaign, character: initialChar, role }: Props) {
  const router = useRouter()
  const [char, setChar] = useState<Partial<Character>>(initialChar ?? {
    stats: { str:10, dex:10, con:10, int:10, wis:10, cha:10 },
    spells: [], inventory: [], level: 1,
    hp_current: 10, hp_max: 10, gold: 0,
  })
  const [editing, setEditing]         = useState(!initialChar)
  const [saving, setSaving]           = useState(false)
  const [tab, setTab]                 = useState<Tab>('core')
  const [skillProf, setSkillProf]     = useState<Record<string,0|1|2>>(() => {
    try { return JSON.parse((initialChar as any)?.skill_profs ?? '{}') } catch { return {} }
  })
  const [saveProf, setSaveProf]       = useState<Record<string,boolean>>(() => {
    const cls = initialChar?.class ?? ''
    const defaults = CLASS_SAVE_PROFS[cls] ?? []
    return Object.fromEntries(defaults.map(a => [a, true]))
  })
  const [deathS, setDeathS]           = useState([false,false,false])
  const [deathF, setDeathF]           = useState([false,false,false])
  const [featPickerOpen, setFeatPickerOpen] = useState(false)
  const [selectedFeatIdx, setSelectedFeatIdx] = useState<number|null>(null)
  const [expandedFeature, setExpandedFeature] = useState<string|null>(null)
  const [, startTransition] = useTransition()
  const [equippedItems, setEquippedItems] = useState<EquippedItem[]>(() => {
    try { return JSON.parse((initialChar as any)?.equipped_items ?? '[]') } catch { return [] }
  })
  const [itemSearch,     setItemSearch]     = useState('')
  const [itemTypeFilter, setItemTypeFilter] = useState('')
  const [expandedItem,   setExpandedItem]   = useState<string | null>(null)

  const isNew = !initialChar
  const stats = char.stats ?? { str:10, dex:10, con:10, int:10, wis:10, cha:10 }
  const suggestedAC = computeArmorClass(equippedItems, getMod(stats.dex ?? 10))
  const level = char.level ?? 1
  const pb = profBonus(level)
  const cls = char.class ?? ''
  const spellAbility = SPELLCASTING_ABILITY[cls] ?? ''
  const spellMod = spellAbility ? getMod(stats[spellAbility] ?? 10) : 0
  const spellSaveDC = spellAbility ? 8 + pb + spellMod : null
  const spellAtk = spellAbility ? pb + spellMod : null
  const cantripCount   = (char.spells ?? []).filter(s => s.level === 0).length
  const preparedCount  = (char.spells ?? []).filter(s => s.level > 0 && s.prepared).length
  const knownCount     = (char.spells ?? []).filter(s => s.level > 0).length
  const cantripCap     = cantripsKnownMax(cls, level)
  const knownCap       = spellsKnownMax(cls, level)
  const preparedCap    = preparedMax(cls, level, spellMod)
  const isKnownCaster  = KNOWN_CASTERS.has(cls)
  const atCantripCap   = cantripCap !== null && cantripCount >= cantripCap
  const atKnownCap     = isKnownCaster && knownCap !== null && knownCount >= knownCap
  const atPreparedCap  = preparedCap !== null && preparedCount >= preparedCap
  const hpPct = char.hp_max ? Math.min(100, ((char.hp_current ?? 0) / char.hp_max) * 100) : 100
  const hpColor = hpPct > 50 ? '#22c55e' : hpPct > 25 ? '#f59e0b' : '#ef4444'
  const slots = NON_CASTERS.has(cls) ? null : (HALF_CASTERS.has(cls) ? SPELL_SLOTS[Math.max(1,Math.floor(level/2))] : SPELL_SLOTS[level])
  const [pendingFeatIdx, setPendingFeatIdx] = useState<number | null>(null)
  const [pendingAsiChoice, setPendingAsiChoice] = useState<string>('')

  const [resourceState, setResourceState] = useState<{ hitDiceUsed: number; classResourceUsed: number }>(() => {
    try { return JSON.parse((initialChar as any)?.resource_state ?? '{}') }
    catch { return { hitDiceUsed: 0, classResourceUsed: 0 } }
  })

  const payload = {
    ...char,
    skill_profs:    JSON.stringify(skillProf),
    equipped_items: JSON.stringify(equippedItems),
    resource_state: JSON.stringify(resourceState),
  }

  // Features stored as JSON string in char.features field
  const parsedFeats: {name:string,desc:string}[] = (() => {
    try { return JSON.parse(char.features ?? '[]') } catch { return [] }
  })()

  function update(patch: Partial<Character>) {
    setChar(c => ({ ...c, ...patch }))
  }

  function updateStat(key: string, val: number) {
    setChar(c => ({ ...c, stats: { ...c.stats, [key]: val } as any }))
  }

  function onClassChange(newClass: string) {
    // Clear old class skill picks before switching
    const oldOptions = CLASS_SKILL_CHOICES[cls]?.options ?? []
    setSkillProf(prev => {
      const next = { ...prev }
      oldOptions.forEach(s => { delete next[s] })
      return next
    })

    update({ class: newClass, subclass: '' })
    const defaults = CLASS_SAVE_PROFS[newClass] ?? []
    setSaveProf(Object.fromEntries(defaults.map(a => [a, true])))
  }

  function onBackgroundChange(newBackground: string) {
    update({ background: newBackground })
    const bg = BACKGROUNDS[newBackground]
    if (!bg) return
    // Auto-apply skill proficiencies from background
    const bgSkills = bg.skills.filter(s => SKILLS.some(sk => sk.name === s))
    setSkillProf(prev => {
      const next = { ...prev }
      bgSkills.forEach(s => { if (!next[s]) next[s] = 1 })
      return next
    })
    // Auto-fill proficiencies text if empty
    if (!char.proficiencies?.trim()) {
      const profText = [
        bg.skills.length ? `Skills: ${bg.skills.join(', ')}` : '',
        bg.tools !== 'None' ? `Tools: ${bg.tools}` : '',
        bg.languages !== 'None' ? `Languages: ${bg.languages}` : '',
      ].filter(Boolean).join('\n')
      update({ background: newBackground, proficiencies: profText })
    }
  }

  // Skill cycling: 0=none, 1=proficient, 2=expertise
  function cycleSkill(name: string) {
    setSkillProf(p => ({ ...p, [name]: (((p[name] ?? 0) + 1) % 3) as 0|1|2 }))
  }

  function skillBonus(sk: typeof SKILLS[number]) {
    const base = getMod(stats[sk.ability] ?? 10)
    const tier = skillProf[sk.name] ?? 0
    return base + (tier === 1 ? pb : tier === 2 ? pb * 2 : 0)
  }

  function saveBonus(ab: string) {
    return getMod(stats[ab] ?? 10) + (saveProf[ab] ? pb : 0)
  }

  function addSpell(level: number) {
    const existing = char.spells ?? []
    update({ spells: [...existing, { name:'', level, prepared: level === 0, used: false }] })
  }

  function addSpellFromApi(s: { name: string; level: number; detail: SpellDetail }) {
    const existing = char.spells ?? []
    if (existing.some(sp => sp.name.trim().toLowerCase() === s.name.trim().toLowerCase())) return
    const newSpell = {
      name: s.name,
      level: s.level,
      prepared: s.level === 0,
      used: false,
      school: s.detail.school?.name,
      castingTime: s.detail.casting_time,
      range: s.detail.range,
      duration: s.detail.duration,
      concentration: !!s.detail.concentration,
      ritual: !!s.detail.ritual,
      components: s.detail.components,
      desc: s.detail.desc,
    } as unknown as Spell
    update({ spells: [...existing, newSpell] })
  }

  function removeSpell(idx: number) {
    const existing = [...(char.spells ?? [])]
    existing.splice(idx, 1)
    update({ spells: existing })
  }

  function updateSpell(idx: number, patch: Partial<Spell>) {
    const existing = [...(char.spells ?? [])]
    existing[idx] = { ...existing[idx], ...patch }
    update({ spells: existing })
  }

  function addInventoryItem() {
    update({ inventory: [...(char.inventory ?? []), { name:'', quantity:1 }] })
  }

  function updateInventory(idx: number, patch: Partial<InventoryItem>) {
    const existing = [...(char.inventory ?? [])]
    existing[idx] = { ...existing[idx], ...patch }
    update({ inventory: existing })
  }

  function removeInventory(idx: number) {
    const existing = [...(char.inventory ?? [])]
    existing.splice(idx, 1)
    update({ inventory: existing })
  }

  function addFeat(idx: number) {
    const feat = FEATS[idx]

    if (feat.asi) {
      if (feat.asi.choose.length === 1) {
        // Only one option — auto-apply
        applyFeatAsi(idx, feat.asi.choose[0])
      } else {
        // Need to prompt
        setPendingFeatIdx(idx)
        setPendingAsiChoice(feat.asi.choose[0])
        return  // don't close the picker yet
      }
    } else {
      commitFeat(idx, null)
    }

    setFeatPickerOpen(false)
    setSelectedFeatIdx(null)
  }

  function applyFeatAsi(featIdx: number, ability: string) {
    const current = stats[ability] ?? 10
    updateStat(ability, Math.min(20, current + FEATS[featIdx].asi!.amount))
    commitFeat(featIdx, ability)
    setPendingFeatIdx(null)
    setPendingAsiChoice('')
    setFeatPickerOpen(false)
    setSelectedFeatIdx(null)
  }

  function commitFeat(idx: number, chosenAbility: string | null) {
    const feat = FEATS[idx]
    const label = chosenAbility
      ? `${feat.name} (+1 ${ABILITY_LABELS[chosenAbility]})`
      : feat.name
    update({ features: JSON.stringify([...parsedFeats, { name: label, desc: feat.desc }]) })
  }

  function removeFeat(idx: number) {
    const current = [...parsedFeats]
    current.splice(idx, 1)
    update({ features: JSON.stringify(current) })
  }

  async function saveCharacter() {
    setSaving(true)
    const payload = {
      ...char,
      skill_profs:    JSON.stringify(skillProf),
      equipped_items: JSON.stringify(equippedItems),
    }
    const res = await fetch(`/api/campaigns/${campaign.id}/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSaving(false)
    if (res.ok) {
      const saved = await res.json()
      setChar(saved)
      setEditing(false)
      startTransition(() => {
        router.push(role === 'dm' ? `/campaigns/${campaign.id}/dm` : `/campaigns/${campaign.id}/play`)
        router.refresh()
      })
    }
  }

  // ── Tab content ──────────────────────────────────────────

  const TABS: { id: Tab; label: string }[] = [
    { id:'core',      label:'Core'      },
    { id:'combat',    label:'Combat'    },
    { id:'skills',    label:'Skills'    },
    { id:'features',  label:'Features'  },
    { id:'spells',    label:'Spells'    },
    { id:'equipment', label:'Equipment' },
    { id:'notes',     label:'Notes'     },
  ]

  return (
    <div className="min-h-screen overflow-auto p-4 md:p-6 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-white font-semibold">{campaign.name}</h1>
          <p className="text-stone-500 text-sm mt-0.5">
            {char.name ?? 'New character'} {char.class ? `· ${char.class}` : ''} {level > 1 ? `Lv ${level}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <button
              onClick={() => setEditing(e => !e)}
              className="text-sm border border-stone-700 text-stone-400 hover:bg-stone-800 px-3 py-1.5 rounded-lg transition-colors"
            >
              {editing ? 'Done' : 'Edit'}
            </button>
          )}
          <button
            onClick={saveCharacter}
            disabled={saving}
            className="text-sm bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-stone-950 font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-stone-800 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
              tab === t.id
                ? 'border-amber-500 text-white font-medium'
                : 'border-transparent text-stone-500 hover:text-stone-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CORE ── */}
      {tab === 'core' && (
        <div className="space-y-4">
          <Section title="Identity">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Character name">
                {editing
                  ? <input value={char.name ?? ''} onChange={e => update({ name: e.target.value })} className={inputCls} placeholder="Kaelith" />
                  : <Value>{char.name}</Value>}
              </Field>
              <Field label="Level">
                {editing
                  ? <input type="number" min={1} max={20} value={level} onChange={e => update({ level: +e.target.value })} className={inputCls} />
                  : <Value>{level}</Value>}
              </Field>
              <Field label="Class">
                {editing
                  ? (
                    <select value={cls} onChange={e => onClassChange(e.target.value)} className={selectCls}>
                      <option value="">— choose —</option>
                      {Object.keys(SUBCLASSES).map(c => <option key={c}>{c}</option>)}
                    </select>
                  )
                  : <Value>{cls}</Value>}
              </Field>
              <Field label="Subclass">
                {editing
                  ? (
                    <select value={char.subclass ?? ''} onChange={e => update({ subclass: e.target.value })} className={selectCls} disabled={!cls}>
                      <option value="">{cls ? '— choose —' : '— pick class first —'}</option>
                      {(SUBCLASSES[cls] ?? []).map(s => <option key={s}>{s}</option>)}
                    </select>
                  )
                  : <Value>{char.subclass}</Value>}
              </Field>
              <Field label="Race">
                {editing
                  ? (
                    <select value={char.race ?? ''} onChange={e => update({ race: e.target.value })} className={selectCls}>
                      <option value="">— choose —</option>
                      {Object.keys(RACE_TRAITS).map(r => <option key={r}>{r}</option>)}
                    </select>
                  )
                  : <Value>{char.race}</Value>}
              </Field>
              <Field label="Background">
                {editing
                  ? (
                    <select value={char.background ?? ''} onChange={e => onBackgroundChange(e.target.value)} className={selectCls}>
                      <option value="">— choose —</option>
                      {Object.keys(BACKGROUNDS).map(b => <option key={b}>{b}</option>)}
                    </select>
                  )
                  : <Value>{char.background}</Value>}
              </Field>
            </div>
          </Section>

          {char.race && RACE_TRAITS[char.race] && (
            <Section title={`${char.race} traits`}>
              <p className="text-stone-300 text-sm leading-relaxed">{RACE_TRAITS[char.race]}</p>
            </Section>
          )}

          {char.background && BACKGROUNDS[char.background] && (() => {
            const bg = BACKGROUNDS[char.background]
            return (
              <Section title={`${char.background} background`}>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-stone-500 text-xs mb-1">Skill proficiencies</div>
                      <div className="text-stone-300">{bg.skills.join(', ')}</div>
                    </div>
                    <div>
                      <div className="text-stone-500 text-xs mb-1">Languages</div>
                      <div className="text-stone-300">{bg.languages}</div>
                    </div>
                    <div>
                      <div className="text-stone-500 text-xs mb-1">Tool proficiencies</div>
                      <div className="text-stone-300">{bg.tools}</div>
                    </div>
                    <div>
                      <div className="text-stone-500 text-xs mb-1">Starting equipment</div>
                      <div className="text-stone-300 text-xs leading-relaxed">{bg.equipment}</div>
                    </div>
                  </div>
                  <div className="border-t border-stone-800 pt-3">
                    <div className="text-amber-500 text-xs font-medium mb-1">{bg.feature}</div>
                    <p className="text-stone-400 text-xs leading-relaxed">{bg.featureDesc}</p>
                  </div>
                  <div className="border-t border-stone-800 pt-3 grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-stone-500">Trait: </span><span className="text-stone-400">{bg.trait}</span></div>
                    <div><span className="text-stone-500">Ideal: </span><span className="text-stone-400">{bg.ideal}</span></div>
                    <div><span className="text-stone-500">Bond: </span><span className="text-stone-400">{bg.bond}</span></div>
                    <div><span className="text-stone-500">Flaw: </span><span className="text-stone-400">{bg.flaw}</span></div>
                  </div>
                </div>
              </Section>
            )
          })()}

          <Section title="Ability scores">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {ABILITIES.map(ab => {
                const score = stats[ab] ?? 10
                const mod = getMod(score)
                return (
                  <div key={ab} className="text-center">
                    <div className="text-stone-500 text-xs mb-1 uppercase">{ab}</div>
                    {editing
                      ? <input type="number" min={1} max={30} value={score} onChange={e => updateStat(ab, +e.target.value)} className="w-full text-center bg-stone-800 border border-stone-700 rounded-lg py-1.5 text-white text-sm focus:outline-none focus:border-amber-500" />
                      : <div className="bg-stone-800 rounded-lg py-2"><div className="text-white font-semibold text-lg leading-none">{score}</div></div>
                    }
                    <div className="text-stone-500 text-xs mt-1">{modStr(mod)}</div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-stone-500 border-t border-stone-800 pt-3">
              <div>Prof bonus: <span className="text-stone-300 font-medium">{modStr(pb)}</span></div>
              <div>Initiative: <span className="text-stone-300 font-medium">{modStr(getMod(stats.dex ?? 10))}</span></div>
              <div>Passive Perc: <span className="text-stone-300 font-medium">{10 + getMod(stats.wis ?? 10) + ((skillProf['Perception'] ?? 0) >= 1 ? pb : 0)}</span></div>
            </div>
          </Section>
        </div>
      )}

      {/* ── COMBAT ── */}
      {tab === 'combat' && (
        <div className="space-y-4">
          <br/>
          <Section title="Hit points">
            <div className="w-full h-2 bg-stone-800 rounded-full overflow-hidden mb-3">
              <div className="h-full rounded-full transition-all" style={{ width: `${hpPct}%`, background: hpColor }} />
            </div>
            <div className="flex items-center gap-3 mb-3">
              <button onClick={() => update({ hp_current: Math.max(0, (char.hp_current ?? 0) - 1) })}>−</button>
              <div className="flex-1 text-center">
                {editing
                  ? (
                    <div className="flex items-center justify-center gap-2">
                      <input type="number" value={char.hp_current ?? 10} onChange={e => update({ hp_current: +e.target.value })} className="w-16 text-center bg-stone-800 border border-stone-700 rounded-lg py-1 text-white text-sm focus:outline-none" />
                      <span className="text-stone-600">/</span>
                      <input type="number" value={char.hp_max ?? 10} onChange={e => update({ hp_max: +e.target.value })} className="w-16 text-center bg-stone-800 border border-stone-700 rounded-lg py-1 text-white text-sm focus:outline-none" />
                    </div>
                  )
                  : <span className="text-white text-xl font-semibold">{char.hp_current ?? 10} <span className="text-stone-500 font-normal text-sm">/ {char.hp_max ?? 10}</span></span>
                }
              </div>
              <button onClick={() => update({ hp_current: Math.min(char.hp_max ?? 10, (char.hp_current ?? 0) + 1) })}>+</button>
            </div>
          </Section>

          <br/>

          <div className="grid grid-cols-3 gap-3">
            <Section title="AC">
              {editing
                ? <input type="number" value={(char as any).ac ?? 10} onChange={e => update({ ac: +e.target.value } as any)} className={inputCls + ' text-center text-xl font-semibold'} />
                : <div className="text-white text-2xl font-semibold text-center py-1">{(char as any).ac ?? 10}</div>}
              {editing && suggestedAC !== null && suggestedAC !== ((char as any).ac ?? 10) && (
                <button
                  onClick={() => update({ ac: suggestedAC } as any)}
                  className="mt-2 w-full text-xs text-amber-500 hover:text-amber-400 transition-colors"
                >
                  Use {suggestedAC} (from equipped armor)
                </button>
              )}
            </Section>
            <Section title="Initiative">
              <div className="text-white text-2xl font-semibold text-center py-1">{modStr(getMod(stats.dex ?? 10))}</div>
            </Section>
            <Section title="Speed">
              {editing
                ? <input type="number" value={(char as any).speed ?? 30} onChange={e => update({ ...char, speed: +e.target.value } as any)} className={inputCls + ' text-center text-xl font-semibold'} />
                : <div className="text-white text-2xl font-semibold text-center py-1">{(char as any).speed ?? 30} ft</div>}
            </Section>
          </div>
          
          <br/>

          <div className="space-y-4">
            {(() => {
              const attacks = computeWeaponAttacks(equippedItems, stats, pb)
              if (attacks.length === 0) return null

              function toggleTwoHanded(index: string) {
                setEquippedItems(prev =>
                  prev.map(e => e.index === index ? { ...e, twoHanded: !e.twoHanded } : e)
                )
              }

              return (
                <Section title="Attacks">
                  <div className="space-y-2">
                    {attacks.map(atk => (
                      <div key={atk.index} className="flex items-center gap-3 py-1.5 border-b border-stone-800 last:border-0">
                        <span className="text-stone-200 text-sm flex-1 min-w-0 truncate">{atk.name}</span>

                        {atk.isVersatile && (
                          <button
                            onClick={() => toggleTwoHanded(atk.index)}
                            title="Toggle two-handed grip (versatile weapon)"
                            className={`text-xs px-2 py-0.5 rounded-full border transition-colors flex-shrink-0 ${
                              atk.twoHanded
                                ? 'bg-amber-500 border-amber-500 text-stone-950 font-medium'
                                : 'border-stone-700 text-stone-500 hover:border-stone-500 hover:text-stone-300'
                            }`}
                          >
                            {atk.twoHanded ? '2H' : '1H'}
                          </button>
                        )}

                        <span className="text-white text-sm font-medium whitespace-nowrap">{modStr(atk.atkBonus)} to hit</span>
                        <span className="text-stone-400 text-xs whitespace-nowrap">
                          {atk.damageDice}{atk.damageMod !== 0 ? modStr(atk.damageMod) : ''} {atk.damageType}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-stone-700 text-xs mt-3">
                    Assumes proficiency with all equipped weapons.
                  </p>
                </Section>
              )
            })()}
          </div>

          <br/>
          <Section title="Death saves">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-stone-500 text-xs mb-2">Successes</div>
                <div className="flex gap-2">
                  {deathS.map((v,i) => (
                    <button key={i} onClick={() => setDeathS(d => d.map((x,j) => j===i ? !x : x) as [boolean,boolean,boolean])}
                      className={`w-5 h-5 rounded-full border transition-colors ${v ? 'bg-green-500 border-green-500' : 'border-stone-600 bg-stone-800'}`} />
                  ))}
                </div>
              </div>
              <div>
                <div className="text-stone-500 text-xs mb-2">Failures</div>
                <div className="flex gap-2">
                  {deathF.map((v,i) => (
                    <button key={i} onClick={() => setDeathF(d => d.map((x,j) => j===i ? !x : x) as [boolean,boolean,boolean])}
                      className={`w-5 h-5 rounded-full border transition-colors ${v ? 'bg-red-500 border-red-500' : 'border-stone-600 bg-stone-800'}`} />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <br/>

          {CLASS_HIT_DIE[cls] && (() => {
            const die = CLASS_HIT_DIE[cls]
            const max = level
            const used = Math.min(resourceState.hitDiceUsed, max)
            const remaining = max - used
            return (
              <Section title="Hit dice">
                <div className="flex items-center justify-between">
                  <span className="text-white text-lg font-semibold">{remaining}d{die}<span className="text-stone-500 text-sm font-normal"> / {max}</span></span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setResourceState(r => ({ ...r, hitDiceUsed: Math.min(max, r.hitDiceUsed + 1) }))}
                      className="text-xs border border-stone-700 text-stone-400 hover:bg-stone-800 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Spend
                    </button>
                    <button
                      onClick={() => setResourceState(r => ({ ...r, hitDiceUsed: Math.max(0, r.hitDiceUsed - 1) }))}
                      className="text-xs border border-stone-700 text-stone-400 hover:bg-stone-800 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Restore
                    </button>
                  </div>
                </div>
                <p className="text-stone-700 text-xs mt-2">Regain half your total (rounded up) on a long rest.</p>
              </Section>
            )
          })()}

          {CLASS_RESOURCE[cls] && (() => {
            const { label, max: maxFn, resetsOn } = CLASS_RESOURCE[cls]
            const max = maxFn(level)
            if (max <= 0) return null
            const used = Math.min(resourceState.classResourceUsed, max)
            const remaining = max - used
            return (
              <Section title={label}>
                <div className="flex items-center justify-between">
                  <span className="text-white text-lg font-semibold">{remaining}<span className="text-stone-500 text-sm font-normal"> / {max}</span></span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setResourceState(r => ({ ...r, classResourceUsed: Math.min(max, r.classResourceUsed + 1) }))}
                      className="text-xs border border-stone-700 text-stone-400 hover:bg-stone-800 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Use
                    </button>
                    <button
                      onClick={() => setResourceState(r => ({ ...r, classResourceUsed: 0 }))}
                      className="text-xs bg-amber-500 hover:bg-amber-400 text-stone-950 font-medium px-2.5 py-1 rounded-lg transition-colors"
                    >
                      {resetsOn === 'short' ? 'Short rest' : 'Long rest'}
                    </button>
                  </div>
                </div>
              </Section>
            )
          })()}

          <br/>
          <Section title="Gold">
            {editing
              ? <input type="number" min={0} value={char.gold ?? 0} onChange={e => update({ gold: +e.target.value })} className={inputCls} />
              : <div className="text-amber-400 text-2xl font-semibold">{char.gold ?? 0}<span className="text-stone-500 text-sm font-normal ml-1">gp</span></div>}
          </Section>

          {/* <Section title="Inventory">
            <div className="space-y-2">
              {(char.inventory ?? []).map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  {editing
                    ? <>
                        <input value={item.name} onChange={e => updateInventory(i, { name: e.target.value })} className={inputCls + ' flex-1'} placeholder="Item name" />
                        <input type="number" min={1} value={item.quantity} onChange={e => updateInventory(i, { quantity: +e.target.value })} className="w-16 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none" />
                        <button onClick={() => removeInventory(i)} className="text-stone-600 hover:text-red-400 transition-colors"><X size={14} /></button>
                      </>
                    : <span className="text-stone-300 text-sm">{item.quantity > 1 ? `${item.quantity}× ` : ''}{item.name}</span>
                  }
                </div>
              ))}
            </div>
            {editing && (
              <button onClick={addInventoryItem} className="mt-2 flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-300 transition-colors">
                <Plus size={12} /> Add item
              </button>
            )}
          </Section> */}
        </div>
      )}

      {/* ── SKILLS ── */}
      {tab === 'skills' && (
        <div className="space-y-4">
          <Section title="Saving throws">
            <div className="grid grid-cols-2 gap-1">
              {ABILITIES.map(ab => (
                <div key={ab} className="flex items-center gap-2 py-1">
                  <button
                    onClick={() => setSaveProf(p => ({ ...p, [ab]: !p[ab] }))}
                    className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 transition-colors ${saveProf[ab] ? 'bg-amber-500 border-amber-500' : 'border-stone-600 bg-stone-800'}`}
                  />
                  <span className="text-stone-400 text-xs w-10 uppercase">{ab}</span>
                  <span className="text-white text-sm font-medium">{modStr(saveBonus(ab))}</span>
                </div>
              ))}
            </div>
            {cls && CLASS_SKILL_CHOICES[cls] && (() => {
              const { count, options } = CLASS_SKILL_CHOICES[cls]
              const chosen = options.filter(s => (skillProf[s] ?? 0) > 0)
              const remaining = count - chosen.length

              return (
                <Section title={`${cls} skill proficiencies`}>
                  <p className="text-stone-500 text-xs mb-3">
                    Choose {count} from your class list.{' '}
                    {remaining > 0
                      ? <span className="text-amber-500">{remaining} remaining</span>
                      : <span className="text-green-500">Done ✓</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {options.map(skill => {
                      const tier = skillProf[skill] ?? 0
                      const isChosen = tier > 0
                      const atLimit = chosen.length >= count && !isChosen
                      return (
                        <button
                          key={skill}
                          disabled={atLimit}
                          onClick={() => setSkillProf(p => ({
                            ...p,
                            [skill]: isChosen ? 0 : 1,
                          }))}
                          className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                            isChosen
                              ? 'bg-amber-500 border-amber-500 text-stone-950 font-medium'
                              : atLimit
                              ? 'border-stone-800 text-stone-700 cursor-not-allowed'
                              : 'border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-300'
                          }`}
                        >
                          {skill}
                        </button>
                      )
                    })}
                  </div>
                </Section>
              )
            })()}
          </Section>

          <Section title="Skills">
            <p className="text-stone-600 text-xs mb-3">Click dot to cycle: ○ none → ● proficient → ◐ expertise</p>
            <div className="space-y-0.5">
              {SKILLS.map(sk => {
                const tier = skillProf[sk.name] ?? 0
                const bonus = skillBonus(sk)
                const dot = tier === 2 ? '◐' : tier === 1 ? '●' : '○'
                return (
                  <div key={sk.name} className="flex items-center gap-2 py-1 hover:bg-stone-800/50 rounded px-1">
                    <button onClick={() => cycleSkill(sk.name)} className={`text-sm w-4 flex-shrink-0 ${tier > 0 ? 'text-amber-500' : 'text-stone-600'}`}>{dot}</button>
                    <span className="text-stone-500 text-xs w-8 uppercase">{sk.ability}</span>
                    <span className="text-stone-300 text-sm flex-1">{sk.name}</span>
                    <span className="text-white text-sm font-medium">{modStr(bonus)}</span>
                  </div>
                )
              })}
            </div>
          </Section>

          <Section title="Proficiencies & languages">
            <textarea
              value={char.proficiencies ?? ''}
              onChange={e => update({ proficiencies: e.target.value })}
              readOnly={!editing}
              rows={4}
              placeholder="Armor, weapons, tools, languages..."
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 resize-none read-only:bg-transparent read-only:border-transparent read-only:px-0 transition-colors"
            />
          </Section>
        </div>
      )}

      {/* ── FEATURES ── */}
      {tab === 'features' && (
        <div className="space-y-4">
          {cls && (
            <Section title={`${cls} features · Level ${level}`}>
              <div className="space-y-1">
                {(CLASS_FEATURES[cls] ?? [])
                  .filter(([l]) => l <= level)
                  .map(([l, name, desc]) => (
                    <div key={name} className="border-b border-stone-800 last:border-0">
                      <button
                        onClick={() => setExpandedFeature(expandedFeature === name ? null : name)}
                        className="w-full flex items-center justify-between py-2 text-left hover:bg-stone-800/40 rounded px-1 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">{name}</span>
                          <span className="text-stone-600 text-xs">Lv {l}</span>
                        </div>
                        {expandedFeature === name ? <ChevronUp size={14} className="text-stone-500" /> : <ChevronDown size={14} className="text-stone-500" />}
                      </button>
                      {expandedFeature === name && (
                        <p className="text-stone-400 text-sm leading-relaxed pb-2 px-1">{desc}</p>
                      )}
                    </div>
                  ))}
                {(CLASS_FEATURES[cls] ?? []).filter(([l]) => l <= level).length === 0 && (
                  <p className="text-stone-600 text-sm">Increase your level to unlock features.</p>
                )}
              </div>
              {(CLASS_FEATURES[cls] ?? []).some(([l]) => l > level) && (
                <p className="text-stone-600 text-xs mt-3">
                  Next: {CLASS_FEATURES[cls].find(([l]) => l > level)?.[1]} at level {CLASS_FEATURES[cls].find(([l]) => l > level)?.[0]}
                </p>
              )}
            </Section>
          )}

          <Section title="Feats">
            <div className="space-y-2 mb-3">
              {parsedFeats.map((f, i) => (
                <div key={i} className="bg-stone-800/60 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-white text-sm font-medium">{f.name}</span>
                    {editing && (
                      <button onClick={() => removeFeat(i)} className="text-stone-600 hover:text-red-400 transition-colors flex-shrink-0"><X size={13} /></button>
                    )}
                  </div>
                  <p className="text-stone-400 text-xs leading-relaxed mt-1">{f.desc}</p>
                </div>
              ))}
              {parsedFeats.length === 0 && <p className="text-stone-600 text-sm">No feats yet.</p>}
            </div>

            {editing && !featPickerOpen && (
              <button onClick={() => setFeatPickerOpen(true)} className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-300 transition-colors">
                <Plus size={12} /> Add feat
              </button>
            )}

            {featPickerOpen && (
              <div className="bg-stone-800/60 rounded-lg p-3 space-y-2">
                <select
                  value={selectedFeatIdx ?? ''}
                  onChange={e => setSelectedFeatIdx(e.target.value ? +e.target.value : null)}
                  className={selectCls}
                >
                  <option value="">— choose a feat —</option>
                  {FEATS.map((f, i) => <option key={i} value={i}>{f.name}</option>)}
                </select>
                {selectedFeatIdx !== null && FEATS[selectedFeatIdx].asi && FEATS[selectedFeatIdx].asi!.choose.length > 1 && (
                  <div className="bg-stone-900 border border-amber-500/30 rounded-lg p-3 space-y-2">
                    <p className="text-amber-400 text-xs font-medium">
                      Choose ability score to increase by {FEATS[selectedFeatIdx].asi!.amount}:
                    </p>
                    <div className="flex gap-2">
                      {FEATS[selectedFeatIdx].asi!.choose.map(ab => (
                        <button
                          key={ab}
                          onClick={() => setPendingAsiChoice(ab)}
                          className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                            pendingAsiChoice === ab
                              ? 'bg-amber-500 border-amber-500 text-stone-950 font-medium'
                              : 'border-stone-700 text-stone-400 hover:border-stone-500'
                          }`}
                        >
                          {ABILITY_LABELS[ab]} ({modStr(getMod(stats[ab] ?? 10))})
                          <span className="ml-1 text-stone-500">→ {Math.min(20, (stats[ab] ?? 10) + FEATS[selectedFeatIdx].asi!.amount)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (selectedFeatIdx === null) return
                      const feat = FEATS[selectedFeatIdx]
                      if (feat.asi && feat.asi.choose.length > 1) {
                        applyFeatAsi(selectedFeatIdx, pendingAsiChoice)
                      } else {
                        addFeat(selectedFeatIdx)
                      }
                    }}
                    disabled={selectedFeatIdx === null}
                    className="text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Add
                  </button>
                  <button onClick={() => { setFeatPickerOpen(false); setSelectedFeatIdx(null) }} className="text-xs border border-stone-700 text-stone-400 hover:bg-stone-800 px-3 py-1.5 rounded-lg transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Section>

          <Section title="Personality">
            <div className="grid grid-cols-2 gap-3">
              {([
                ['Traits',    'personality', 'Quirks, mannerisms…'],
                ['Ideals',    'ideals',      'Beliefs, principles…'],
                ['Bonds',     'bonds',       'Loyalties, connections…'],
                ['Flaws',     'flaws',       'Weaknesses, vices…'],
              ] as const).map(([label, key, ph]) => (
                <div key={key}>
                  <label className="text-stone-600 text-xs block mb-1">{label}</label>
                  <textarea
                    value={(char as any)[key] ?? ''}
                    onChange={e => update({ [key]: e.target.value } as any)}
                    readOnly={!editing}
                    rows={3}
                    placeholder={ph}
                    className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-xs placeholder-stone-600 focus:outline-none focus:border-amber-500 resize-none read-only:bg-transparent read-only:border-transparent read-only:px-0 transition-colors"
                  />
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* ── SPELLS ── */}
      {tab === 'spells' && (
        <div className="space-y-4">
          {NON_CASTERS.has(cls) && cls && (
            <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 text-stone-500 text-sm">
              {cls}s don't have spellcasting — unless a subclass or feat grants it.
            </div>
          )}

          {spellAbility && (
            <Section title="Spellcasting">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-stone-800 rounded-lg py-3">
                  <div className="text-stone-500 text-xs mb-1">Ability</div>
                  <div className="text-white font-medium uppercase">{spellAbility}</div>
                </div>
                <div className="bg-stone-800 rounded-lg py-3">
                  <div className="text-stone-500 text-xs mb-1">Save DC</div>
                  <div className="text-white text-lg font-semibold">{spellSaveDC}</div>
                </div>
                <div className="bg-stone-800 rounded-lg py-3">
                  <div className="text-stone-500 text-xs mb-1">Atk bonus</div>
                  <div className="text-white text-lg font-semibold">{modStr(spellAtk ?? 0)}</div>
                </div>
              </div>
            </Section>
          )}

          {(cantripCap !== null || knownCap !== null || preparedCap !== null) && (
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-stone-500 border-t border-stone-800 pt-3">
              {cantripCap !== null && (
                <span>Cantrips: <span className={atCantripCap ? 'text-amber-400' : 'text-stone-300'}>{cantripCount} / {cantripCap}</span></span>
              )}
              {isKnownCaster && knownCap !== null && (
                <span>Spells known: <span className={atKnownCap ? 'text-amber-400' : 'text-stone-300'}>{knownCount} / {knownCap}</span></span>
              )}
              {!isKnownCaster && preparedCap !== null && (
                <span>Prepared: <span className={atPreparedCap ? 'text-amber-400' : 'text-stone-300'}>{preparedCount} / {preparedCap}</span></span>
              )}
            </div>
          )}

          {!NON_CASTERS.has(cls) && (
            <SpellLookupSection
              existingSpells={char.spells ?? []}
              onAddSpell={addSpellFromApi}
              cantripBlocked={atCantripCap}
              cantripBlockedReason={cantripCap != null ? `Cantrip limit reached (${cantripCap})` : undefined}
              knownBlocked={isKnownCaster && atKnownCap}
              knownBlockedReason={knownCap != null ? `Spells known limit reached (${knownCap})` : undefined}
            />
          )}

          {/* Cantrips */}
          <SpellLevelSection
            label="Cantrips"
            spellLevel={0}
            slots={null}
            spells={(char.spells ?? []).filter(s => s.level === 0)}
            allSpells={char.spells ?? []}
            editing={editing}
            onAdd={() => addSpell(0)}
            onRemove={removeSpell}
            onUpdate={updateSpell}
            addDisabled={atCantripCap}
            addDisabledReason={atCantripCap ? `Cantrip limit reached (${cantripCap})` : undefined}
          />

          {/* Spell levels */}
          {slots && slots.map((count, i) => {
            if (count === 0) return null
            const lvl = i + 1
            return (
              <SpellLevelSection
                key={lvl}
                label={`Level ${lvl}`}
                spellLevel={lvl}
                slots={count}
                spells={(char.spells ?? []).filter(s => s.level === lvl)}
                allSpells={char.spells ?? []}
                editing={editing}
                onAdd={() => addSpell(lvl)}
                onRemove={removeSpell}
                onUpdate={updateSpell}
                addDisabled={isKnownCaster ? atKnownCap : false}
                addDisabledReason={isKnownCaster && atKnownCap ? `Spells known limit reached (${knownCap})` : undefined}
                prepCapReached={!isKnownCaster && atPreparedCap}
              />
            )
          })}

          {!spellAbility && !NON_CASTERS.has(cls) && (
            <p className="text-stone-600 text-sm p-4">Select a spellcasting class to see spell slots.</p>
          )}
        </div>
      )}

      {/* ── EQUIPMENT ── */}
      {tab === 'equipment' && (
        <EquipmentTab
          equippedItems={equippedItems}
          setEquippedItems={setEquippedItems}
          editing={editing}
        />
      )}

      {/* ── NOTES ── */}
      {tab === 'notes' && (
        <div className="space-y-4">
          <Section title="Session notes">
            <textarea
              value={char.notes ?? ''}
              onChange={e => update({ notes: e.target.value })}
              rows={8}
              placeholder="Quest hooks, NPC names, important events…"
              className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2.5 text-stone-300 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500 resize-none transition-colors"
            />
          </Section>
          <Section title="Appearance">
            <div className="grid grid-cols-3 gap-3">
              {(['Age','Height','Weight','Eyes','Skin','Hair'] as const).map(label => (
                <Field key={label} label={label}>
                  <input
                    value={(char as any)[label.toLowerCase()] ?? ''}
                    onChange={e => update({ [label.toLowerCase()]: e.target.value } as any)}
                    readOnly={!editing}
                    className={inputCls + ' read-only:bg-transparent read-only:border-transparent read-only:px-0'}
                  />
                </Field>
              ))}
            </div>
          </Section>
        </div>
      )}

    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
      <h2 className="text-stone-500 text-xs font-medium uppercase tracking-wide mb-3">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-stone-600 text-xs block mb-1">{label}</label>
      {children}
    </div>
  )
}

function Value({ children }: { children: React.ReactNode }) {
  return <span className="text-white text-sm">{children ?? '—'}</span>
}

interface SpellLevelSectionProps {
  label: string
  spellLevel: number
  slots: number | null
  spells: Spell[]
  allSpells: Spell[]
  editing: boolean
  onAdd: () => void
  onRemove: (idx: number) => void
  onUpdate: (idx: number, patch: Partial<Spell>) => void
  addDisabled?: boolean
  addDisabledReason?: string
  prepCapReached?: boolean
}

function SpellLevelSection({
  label, spellLevel, slots, spells, allSpells, editing,
  onAdd, onRemove, onUpdate,
  addDisabled, addDisabledReason, prepCapReached,
}: SpellLevelSectionProps) {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-stone-500 text-xs font-medium uppercase tracking-wide">{label}</h2>
        {slots !== null && (
          <span className="text-stone-600 text-xs">{slots} slot{slots !== 1 ? 's' : ''}/day</span>
        )}
      </div>
      <div className="space-y-1.5">
        {spells.map(spell => {
          const idx = allSpells.indexOf(spell)
          const meta = (spell as any) as {
            school?: string; castingTime?: string; range?: string
            duration?: string; concentration?: boolean; ritual?: boolean
          }
          const metaParts = [
            meta.school,
            meta.castingTime,
            meta.range,
            meta.duration ? `${meta.duration}${meta.concentration ? ' (C)' : ''}` : null,
            meta.ritual ? 'Ritual' : null,
          ].filter(Boolean)
          const blockPrepare = !spell.prepared && !!prepCapReached
          return (
            <div key={idx} className="py-0.5">
              <div className="flex items-center gap-2">
                {spellLevel > 0 && (
                  <button
                    onClick={() => {
                      if (blockPrepare) return
                      onUpdate(idx, { prepared: !spell.prepared })
                    }}
                    title={
                      spell.prepared
                        ? 'Prepared — click to unprepare'
                        : blockPrepare
                        ? 'Prepared limit reached'
                        : 'Not prepared'
                    }
                    className={`w-3.5 h-3.5 rounded-full border flex-shrink-0 transition-colors ${
                      spell.prepared
                        ? 'bg-amber-500 border-amber-500'
                        : blockPrepare
                        ? 'border-stone-800 bg-stone-900 cursor-not-allowed'
                        : 'border-stone-600 bg-stone-800'
                    }`}
                  />
                )}
                {editing
                  ? (
                    <input
                      value={spell.name}
                      onChange={e => onUpdate(idx, { name: e.target.value })}
                      className="flex-1 bg-stone-800 border border-stone-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-amber-500"
                      placeholder={spellLevel === 0 ? 'Cantrip name' : 'Spell name'}
                    />
                  )
                  : <span className={`text-sm flex-1 ${spell.prepared || spellLevel === 0 ? 'text-stone-300' : 'text-stone-600'}`}>{spell.name || '—'}</span>
                }
                <button onClick={() => onRemove(idx)} className="text-stone-600 hover:text-red-400 transition-colors flex-shrink-0"><X size={13} /></button>
              </div>
              {metaParts.length > 0 && (
                <div className="text-stone-600 text-xs pl-5 pt-0.5">{metaParts.join(' · ')}</div>
              )}
            </div>
          )
        })}
        {spells.length === 0 && <p className="text-stone-700 text-xs">None added yet.</p>}
      </div>
      {editing && (
        <div className="mt-2">
          <button
            onClick={onAdd}
            disabled={addDisabled}
            className={`flex items-center gap-1 text-xs transition-colors ${addDisabled ? 'text-stone-700 cursor-not-allowed' : 'text-stone-600 hover:text-stone-400'}`}
          >
            <Plus size={11} /> Add
          </button>
          {addDisabled && addDisabledReason && (
            <p className="text-stone-700 text-xs mt-1">{addDisabledReason}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Spell lookup (search & add) ───────────────────────────────

interface ApiSpellRef {
  index: string
  name:  string
  url:   string
}

interface SpellDetail {
  name:            string
  level:           number
  school?:         { name: string }
  casting_time?:   string
  range?:          string
  duration?:       string
  concentration?:  boolean
  ritual?:         boolean
  components?:     string[]
  material?:       string
  desc?:           string[]
  higher_level?:   string[]
  classes?:        { name: string }[]
}

function cantripsKnownMax(cls: string, level: number): number | null {
  return CANTRIPS_KNOWN[cls]?.[level - 1] ?? null
}

function spellsKnownMax(cls: string, level: number): number | null {
  return SPELLS_KNOWN[cls]?.[level - 1] ?? null
}

function preparedMax(cls: string, level: number, mod: number): number | null {
  if (!['Cleric','Druid','Paladin','Wizard'].includes(cls)) return null
  const effLevel = cls === 'Paladin' ? Math.floor(level / 2) : level
  return Math.max(1, mod + effLevel)
}

function SpellLookupSection({
  existingSpells,
  onAddSpell,
  cantripBlocked,
  cantripBlockedReason,
  knownBlocked,
  knownBlockedReason,
}: {
  existingSpells: Spell[]
  onAddSpell: (s: { name: string; level: number; detail: SpellDetail }) => void
  cantripBlocked?: boolean
  cantripBlockedReason?: string
  knownBlocked?: boolean
  knownBlockedReason?: string
}) {
  const [search,        setSearch]        = useState('')
  const [results,       setResults]       = useState<ApiSpellRef[]>([])
  const [searching,     setSearching]     = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null)
  const [detailCache,   setDetailCache]   = useState<Record<string, SpellDetail>>({})
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAdded = (name: string) =>
    existingSpells.some(s => s.name.trim().toLowerCase() === name.trim().toLowerCase())

  function handleAdd(item: ApiSpellRef) {
    const d = detailCache[item.index]
    if (!d) return
    onAddSpell({ name: d.name, level: d.level, detail: d })
    setExpandedIndex(null)
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!search.trim()) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res  = await fetch(`https://www.dnd5eapi.co/api/2014/spells?name=${encodeURIComponent(search)}`)
        const data = await res.json()
        setResults(data.results ?? [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 350)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  async function fetchDetail(item: ApiSpellRef) {
    if (detailCache[item.index]) {
      setExpandedIndex(prev => prev === item.index ? null : item.index)
      return
    }
    setLoadingDetail(item.index)
    setExpandedIndex(item.index)
    try {
      const res  = await fetch(`https://www.dnd5eapi.co${item.url}`)
      const data = await res.json()
      setDetailCache(c => ({ ...c, [item.index]: data }))
    } finally {
      setLoadingDetail(null)
    }
  }

  return (
    <Section title="Spell lookup">
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search any D&D 5e spell…"
        className={inputCls + ' mb-3'}
      />

      {searching && <p className="text-stone-500 text-sm py-2">Searching…</p>}

      {!searching && search.trim() && results.length === 0 && (
        <p className="text-stone-600 text-sm py-2">No results found.</p>
      )}

      {!searching && !search.trim() && (
        <p className="text-stone-600 text-sm">Type to search the full D&D 5e spell database.</p>
      )}

      <div className="space-y-1.5">
        {results.slice(0, 15).map(item => {
          const isExp     = expandedIndex === item.index
          const d         = detailCache[item.index]
          const isLoading = loadingDetail === item.index
          const added     = isAdded(item.name)
          const isBlocked = d && (d.level === 0 ? !!cantripBlocked : !!knownBlocked)
          const blockedReason = d?.level === 0 ? cantripBlockedReason : knownBlockedReason

          return (
            <div
              key={item.index}
              onClick={() => fetchDetail(item)}
              className={`bg-stone-800/60 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                isExp ? 'border-stone-600' : 'border-stone-800 hover:border-stone-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-stone-200 text-sm font-medium flex-1 min-w-0 truncate">{item.name}</span>

                {d && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium flex-shrink-0">
                    {d.level === 0 ? 'Cantrip' : `Lvl ${d.level}`}
                  </span>
                )}

                {added && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-medium flex-shrink-0">
                    added
                  </span>
                )}

                <ChevronDown
                  size={14}
                  className={`text-stone-600 flex-shrink-0 transition-transform ${isExp ? 'rotate-180' : ''}`}
                />
              </div>

              {isExp && isLoading && (
                <p className="text-stone-500 text-xs mt-2 pt-2 border-t border-stone-700">Loading…</p>
              )}

              {isExp && !isLoading && d && (
                <div className="mt-3 border-t border-stone-700 pt-3" onClick={e => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2 text-xs">
                    {d.school?.name && (
                      <span><span className="text-stone-500">School: </span><span className="text-stone-300">{d.school.name}</span></span>
                    )}
                    {d.casting_time && (
                      <span><span className="text-stone-500">Casting time: </span><span className="text-stone-300">{d.casting_time}</span></span>
                    )}
                    {d.range && (
                      <span><span className="text-stone-500">Range: </span><span className="text-stone-300">{d.range}</span></span>
                    )}
                    {d.duration && (
                      <span><span className="text-stone-500">Duration: </span><span className="text-stone-300">{d.duration}{d.concentration ? ' (Concentration)' : ''}</span></span>
                    )}
                    {d.ritual && <span className="text-stone-300">Ritual</span>}
                    {d.components?.length ? (
                      <span><span className="text-stone-500">Components: </span><span className="text-stone-300">{d.components.join(', ')}{d.material ? ` (${d.material})` : ''}</span></span>
                    ) : null}
                    {d.classes?.length ? (
                      <span><span className="text-stone-500">Classes: </span><span className="text-stone-300">{d.classes.map(c => c.name).join(', ')}</span></span>
                    ) : null}
                  </div>
                  {d.desc?.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {d.desc.map((line, i) => (
                        <p key={i} className="text-stone-400 text-xs leading-relaxed">{line}</p>
                      ))}
                    </div>
                  )}
                  <button
                    disabled={added || isBlocked}
                    onClick={() => handleAdd(item)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      added || isBlocked
                        ? 'border-stone-700 text-stone-600 cursor-not-allowed'
                        : 'border-stone-600 text-stone-300 hover:bg-stone-700 hover:border-stone-500'
                    }`}
                  >
                    <Plus size={11} />
                    {added ? 'Already in spellbook' : isBlocked ? (blockedReason ?? 'Limit reached') : 'Add to spellbook'}
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {results.length > 15 && (
          <p className="text-stone-600 text-xs pt-1">
            Showing 15 of {results.length} — refine your search to narrow down.
          </p>
        )}
      </div>
    </Section>
  )
}

// ── Types ────────────────────────────────────────────────────

interface ApiItem {
  index: string
  name:  string
  url:   string
}

interface ItemDetail {
  name:              string
  equipment_category?: { name: string }
  gear_category?:    { name: string }
  weapon_category?:  string
  armor_category?:   string
  rarity?:           { name: string }
  attunement_optional?: boolean
  requires_attunement?: string
  cost?:             { quantity: number; unit: string }
  weight?:           number
  damage?:           { damage_dice: string; damage_type: { name: string } }
  armor_class?:      { base: number; dex_bonus: boolean; max_bonus?: number }
  str_minimum?:      number
  stealth_disadvantage?: boolean
  range?:            { normal: number; long: number }
  properties?:       { name: string }[]
  desc?:             string[]
  source?:           string
  isMagic?:          boolean
  two_handed_damage?: { damage_dice: string; damage_type: { name: string } }
}

interface EquippedItem {
  index:   string
  name:    string
  type:    string
  rarity:  string
  attune:  boolean
  attuned: boolean
  twoHanded?: boolean
  detail?: ItemDetail
}

// ── Rarity badge ─────────────────────────────────────────────

function RarityBadge({ rarity }: { rarity: string }) {
  const cls =
    rarity === 'Common'    ? 'bg-stone-700 text-stone-400'        :
    rarity === 'Uncommon'  ? 'bg-green-500/15 text-green-400'     :
    rarity === 'Rare'      ? 'bg-blue-500/15 text-blue-400'       :
    rarity === 'Very Rare' ? 'bg-purple-500/15 text-purple-400'   :
    rarity === 'Legendary' ? 'bg-amber-500/15 text-amber-400'     :
    rarity === 'Artifact'  ? 'bg-red-500/15 text-red-400'         :
                             'bg-stone-700 text-stone-400'
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${cls}`}>
      {rarity}
    </span>
  )
}

// ── Equipment tab ─────────────────────────────────────────────

function EquipmentTab({
  equippedItems,
  setEquippedItems,
  editing,
}: {
  equippedItems:    EquippedItem[]
  setEquippedItems: React.Dispatch<React.SetStateAction<EquippedItem[]>>
  editing:          boolean
}) {
  const [search,        setSearch]        = useState('')
  const [typeFilter,    setTypeFilter]    = useState<'all' | 'equipment' | 'magic-items'>('all')
  const [results,       setResults]       = useState<ApiItem[]>([])
  const [searching,     setSearching]     = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null)
  const [detailCache,   setDetailCache]   = useState<Record<string, ItemDetail>>({})
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const attuned = equippedItems.filter(e => e.attuned).length

  // ── Search ──────────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!search.trim()) { setResults([]); return }

    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const fetches: Promise<ApiItem[]>[] = []

        if (typeFilter === 'all' || typeFilter === 'equipment') {
          fetches.push(
            fetch(`https://www.dnd5eapi.co/api/2014/equipment?name=${encodeURIComponent(search)}`)
              .then(r => r.json())
              .then(d => d.results ?? [])
              .catch(() => [])
          )
        }

        if (typeFilter === 'all' || typeFilter === 'magic-items') {
          fetches.push(
            fetch(`https://www.dnd5eapi.co/api/2014/magic-items?name=${encodeURIComponent(search)}`)
              .then(r => r.json())
              .then(d => d.results ?? [])
              .catch(() => [])
          )
        }

        const arrays = await Promise.all(fetches)
        const merged = arrays.flat()
        // dedupe by index
        const seen = new Set<string>()
        setResults(merged.filter(i => { if (seen.has(i.index)) return false; seen.add(i.index); return true }))
      } finally {
        setSearching(false)
      }
    }, 350)
  }, [search, typeFilter])

  // ── Fetch detail ────────────────────────────────────────

  async function fetchDetail(item: ApiItem) {
    if (detailCache[item.index]) {
      setExpandedIndex(prev => prev === item.index ? null : item.index)
      return
    }
    setLoadingDetail(item.index)
    setExpandedIndex(item.index)
    try {
      const res  = await fetch(`https://www.dnd5eapi.co${item.url}`)
      const data = await res.json()
      const isMagic = item.url.includes('magic-items')
      setDetailCache(c => ({ ...c, [item.index]: { ...data, isMagic } }))
    } finally {
      setLoadingDetail(null)
    }
  }

  // ── Add item ────────────────────────────────────────────

  function addItem(item: ApiItem) {
    if (equippedItems.some(e => e.index === item.index)) return
    const d       = detailCache[item.index]
    const isMagic = item.url.includes('magic-items')
    const rarity  = d?.rarity?.name ?? (isMagic ? 'Varies' : 'Standard')
    const attune  = !!(d?.requires_attunement && d.requires_attunement !== 'no') || !!(d?.attunement_optional)
    const type    = d?.equipment_category?.name ?? d?.gear_category?.name ?? (isMagic ? 'Magic Item' : 'Equipment')
    setEquippedItems(prev => [...prev, {
      index: item.index, name: item.name, type, rarity, attune, attuned: false, detail: d,
    }])
    setExpandedIndex(null)
  }

  // ── Detail card ─────────────────────────────────────────

  function ItemDetailCard({ d, index }: { d: ItemDetail; index: string }) {
    const props: [string, string][] = []
    if (d.cost)      props.push(['Cost',    `${d.cost.quantity} ${d.cost.unit}`])
    if (d.weight)    props.push(['Weight',  `${d.weight} lb`])
    if (d.damage)    props.push(['Damage',  `${d.damage.damage_dice} ${d.damage.damage_type.name}`])
    if (d.armor_class) {
      const ac = `${d.armor_class.base}${d.armor_class.dex_bonus ? ' + Dex' : ''}${d.armor_class.max_bonus != null ? ` (max +${d.armor_class.max_bonus})` : ''}`
      props.push(['AC', ac])
    }
    if (d.str_minimum)           props.push(['Str req',  `${d.str_minimum}`])
    if (d.stealth_disadvantage)  props.push(['Stealth',  'Disadvantage'])
    if (d.range)                 props.push(['Range',    `${d.range.normal}/${d.range.long} ft`])
    if (d.weapon_category)       props.push(['Category', d.weapon_category])
    if (d.armor_category)        props.push(['Category', d.armor_category])
    if (d.properties?.length)    props.push(['Properties', d.properties.map(p => p.name).join(', ')])
    if (d.rarity?.name)          props.push(['Rarity',   d.rarity.name])
    if (d.requires_attunement && d.requires_attunement !== 'no')
                                 props.push(['Attunement', d.requires_attunement])

    const alreadyAdded = equippedItems.some(e => e.index === index)

    return (
      <div className="mt-3 border-t border-stone-700 pt-3" onClick={e => e.stopPropagation()}>
        {props.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
            {props.map(([k, v]) => (
              <span key={k} className="text-xs">
                <span className="text-stone-500">{k}: </span>
                <span className="text-stone-300">{v}</span>
              </span>
            ))}
          </div>
        )}
        {d.desc?.length > 0 && (
          <div className="space-y-1 mb-3">
            {d.desc.map((line, i) => (
              <p key={i} className="text-stone-400 text-xs leading-relaxed">{line}</p>
            ))}
          </div>
        )}
        <button
          disabled={alreadyAdded}
          onClick={() => addItem(results.find(r => r.index === index) ?? { index, name: d.name, url: '' })}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
            alreadyAdded
              ? 'border-stone-700 text-stone-600 cursor-not-allowed'
              : 'border-stone-600 text-stone-300 hover:bg-stone-700 hover:border-stone-500'
          }`}
        >
          <Plus size={11} />
          {alreadyAdded ? 'Already equipped' : 'Add to equipment'}
        </button>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Equipped list */}
      <Section title={`Equipped · Attunement ${attuned} / 3`}>
        {equippedItems.length === 0 ? (
          <p className="text-stone-600 text-sm">No items equipped — search below to add.</p>
        ) : (
          <div className="space-y-0">
            {equippedItems.map((item, i) => {
              const isVersatile = item.detail?.properties?.some(p => p.name.toLowerCase() === 'versatile') && !!item.detail?.two_handed_damage
              return(
                <div key={item.index} className="flex items-center gap-2 py-2 border-b border-stone-800 last:border-0">

                  {/* Attunement dot */}
                  {item.attune ? (
                    <button
                      title={item.attuned ? 'Attuned — click to remove' : attuned >= 3 ? 'Attunement limit reached' : 'Click to attune'}
                      onClick={() => {
                        if (!item.attuned && attuned >= 3) return
                        setEquippedItems(prev =>
                          prev.map((e, j) => j === i ? { ...e, attuned: !e.attuned } : e)
                        )
                      }}
                      className={`w-3 h-3 rounded-full border flex-shrink-0 transition-colors ${
                        item.attuned
                          ? 'bg-amber-500 border-amber-500'
                          : attuned >= 3
                          ? 'border-stone-700 bg-stone-800 cursor-not-allowed'
                          : 'border-stone-600 bg-stone-800 hover:border-amber-500'
                      }`}
                    />
                  ) : (
                    <div className="w-3 h-3 flex-shrink-0" />
                  )}

                  <span className="text-stone-300 text-sm flex-1 min-w-0 truncate">{item.name}</span>

                  <RarityBadge rarity={item.rarity} />

                  <span className="text-stone-600 text-xs hidden sm:block flex-shrink-0">{item.type}</span>

                  {item.attune && !item.attuned && attuned >= 3 && (
                    <span className="text-red-500/70 text-xs flex-shrink-0">limit reached</span>
                  )}

                  <button
                    onClick={() => setEquippedItems(prev => prev.filter((_, j) => j !== i))}
                    className="text-stone-600 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <X size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {equippedItems.some(e => e.attune) && (
          <p className="text-stone-700 text-xs mt-3">● attuned &nbsp;○ requires attunement &nbsp;· max 3 attuned</p>
        )}
      </Section>

      {/* Lookup */}
      <Section title="Item lookup">
        <div className="flex gap-2 mb-3">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search any D&D 5e item…"
            className={inputCls + ' flex-1'}
          />
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
            className="bg-stone-800 border border-stone-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
          >
            <option value="all">All</option>
            <option value="equipment">Equipment</option>
            <option value="magic-items">Magic items</option>
          </select>
        </div>

        {searching && (
          <p className="text-stone-500 text-sm py-2">Searching…</p>
        )}

        {!searching && search.trim() && results.length === 0 && (
          <p className="text-stone-600 text-sm py-2">No results found.</p>
        )}

        {!searching && !search.trim() && (
          <p className="text-stone-600 text-sm">Type to search the full D&D 5e item database.</p>
        )}

        <div className="space-y-1.5">
          {results.slice(0, 15).map(item => {
            const isExp = expandedIndex === item.index
            const d     = detailCache[item.index]
            const isLoading = loadingDetail === item.index
            const isMagic = item.url.includes('magic-items')
            const rarity = d?.rarity?.name ?? (isMagic ? 'Magic' : '')

            return (
              <div
                key={item.index}
                onClick={() => fetchDetail(item)}
                className={`bg-stone-800/60 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                  isExp ? 'border-stone-600' : 'border-stone-800 hover:border-stone-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-stone-200 text-sm font-medium flex-1 min-w-0 truncate">{item.name}</span>

                  {rarity && <RarityBadge rarity={rarity} />}

                  {isMagic && !rarity && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-medium">magic</span>
                  )}

                  <ChevronDown
                    size={14}
                    className={`text-stone-600 flex-shrink-0 transition-transform ${isExp ? 'rotate-180' : ''}`}
                  />
                </div>

                {isExp && isLoading && (
                  <p className="text-stone-500 text-xs mt-2 pt-2 border-t border-stone-700">Loading…</p>
                )}

                {isExp && !isLoading && d && (
                  <ItemDetailCard d={d} index={item.index} />
                )}
              </div>
            )
          })}

          {results.length > 15 && (
            <p className="text-stone-600 text-xs pt-1">
              Showing 15 of {results.length} — refine your search to narrow down.
            </p>
          )}
        </div>
      </Section>

    </div>
  )
}