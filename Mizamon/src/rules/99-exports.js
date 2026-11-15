// What the headless tests and the balance script can reach.
const RULES = {
  SAVE_VERSION, SAVE_KEY, OPTIONS_KEY, MAX_LEVEL, PARTY_MAX, ARCHIVE_MAX, MOVES_MAX, NAME_MAX, STAT_KEYS, STAGE_KEYS, START_MONEY, START_BAG,
  DAMAGE_DIVISOR, CRIT_CHANCE, OVERTIME_TURN, USELESS_MOVE_SCORE, ENCOUNTER_CHANCE, BLACKOUT_MONEY_KEEP, XP_DIVISOR, TRAINER_XP_BONUS, XP_SCALE_FROM,
  makeRng, randInt, pickOne, pickWeighted, hashString,
  TYPE_IDS, TYPE_RULES, TYPE_CHART, typeMultiplier, ABILITY_IDS, STATUSES, MOVES, SPECIES, DEX_ORDER, STARTERS, RIVAL_STARTER, ITEMS, ITEM_IDS, SHOP_STOCK, SHOP_STOCK_NOTIA, SHOP_STOCK_VOREIA, SHOP_STOCK_DYTIKA, shopStockOf,
  STRINGS, formatText, lookupString, monLabel, eventText,
  statOf, maxHp, xpForLevel, levelFromXp, movesAtLevel, makeMon, cloneMon, healMon, monIsAlive, partyHasAlive, hospitalHeal, canDeposit, depositMon, canWithdraw, withdrawMon, gainXp, evolutionFor, evolveMon,
  abilityOf, effectiveStat, computeDamage, recruitChance, xpReward, canUseItemOn, applyItemToMon,
  createBattle, playTurn, playForcedSwitch, chooseAction, chooseReplacement, scoreMove, legalSwitchIndexes, endBattle, prizeFor, simulateBattle, activeMon,
  TRAINERS, buildTrainerTeam, TILE_DEFS, MAPS, START_MAP, HOSPITAL_SPOT, DEFAULT_HEAL_SPOT, tileAt, tileDef, npcVisible, npcAtTile, findWarp, tileWalkable, zoneAt, rollEncounter,
  reachableTiles, npcTalkable, defaultOptions, normalizeOptions, serializeMon, restoreMon, migrateSave,
  SCREEN_W, SCREEN_H, TOUCH_SIDE_WIDTH, LARGE_TEXT_FACTORS, CAPTION_MIN_FONT, CAPTION_MIN_HEIGHT, CAPTION_MAX_HEIGHT, CAPTION_LONGEST_PAGE, captionHeightFor, HOLD_REPEAT_LEVELS, HOLD_REPEAT_DEFAULT, TOUCH_HANDS,
  ONE_HAND_PAD_HEIGHT, ONE_HAND_BUTTONS, HIT_STEADY_ALPHA, TYPE_MARK_SIZE, TYPE_MARKS, repeatFires, hitLook, evolveGlows, blinkShows, screenLayout, oneHandRects,
  WORLD, WORLD_BADGE_COUNT, mapNode, worldIsRoute, routeMarkerFraction, pointAlongPath, worldMarker, newWorldState, worldVisit, normalizeWorld,
  worldFromOldSave, districtState, placeState, worldCandidates, districtSpecies,
};
