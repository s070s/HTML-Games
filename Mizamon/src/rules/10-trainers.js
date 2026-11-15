// ---- Trainers (CONTENT-SEED section 1 and 11) --------------------------------------------
// TRAINERS is built from data/trainers/ in 02-data.js. '$rival' in a team is replaced by the rival's starter (see RIVAL_STARTER).
// victory: what bossVictory plays (the flag it sets, the two lines around the badge card, the card's texts, the chapter card after the first boss).
// '$rival' is the rival's starter, '$rivalEvo' its middle form (his third fight), '$rivalFinal' its last form (his last fight, the Βουλή).
function resolveTeamSpecies(speciesId, playerStarter) {
  const rivalStarter = RIVAL_STARTER[playerStarter || STARTERS[0]];
  if (speciesId === '$rival') return rivalStarter;
  if (speciesId === '$rivalEvo') return SPECIES[rivalStarter].evo.to;
  if (speciesId === '$rivalFinal') return SPECIES[SPECIES[rivalStarter].evo.to].evo.to; // the last form (the final fight of the Βουλή)
  return speciesId;
}
function buildTrainerTeam(trainerId, playerStarter) {
  const trainer = TRAINERS[trainerId];
  return trainer.team.map(function (entry) {
    return makeMon(resolveTeamSpecies(entry.sp, playerStarter), entry.lv, trainer.boost);
  });
}

