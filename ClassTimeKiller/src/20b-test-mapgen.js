// Self-tests for the S16 map generator (group 'mapgen'). Debug hooks: __CTK.mapgen (MapGen plus sweep(count)).

DebugApi.mapgen = Object.assign(Object.create(MapGen), {
  parts: () => ({ MapScan, MapCheck, MapGenPlace, MapGenKits }),     // for console debugging of a generated map
  // Validates `count` seeds spread over GN1..GN5 and every size: accepted / repaired / fallback counts and the slowest runs.
  sweep(count) {
    const total = count || 100, result = { total, accepted: 0, retried: 0, repaired: 0, fallback: 0, slowestMs: 0, slowest: '', slowestBuildMs: 0, failures: [] };
    for (let i = 0; i < total; i++) {
      const generator = CAT.generators[i % CAT.generators.length], size = CAT.mapSizes[Math.floor(i / CAT.generators.length) % CAT.mapSizes.length];
      const map = MapGen.generate({ generator: generator.code, seed: 1000 + i, size: size.id, uncapped: true });
      const report = MapGen.last, buildMs = report.ms.build + report.ms.place;
      if (report.fallback) { result.fallback++; result.failures.push(generator.code + ' ' + size.id + ' seed ' + (1000 + i) + ': ' + report.problems.slice(0, 2).join(' | ')); }
      else result.accepted++;
      if (report.attempts > 1) result.retried++;
      if (report.repairs) result.repaired++;
      if (report.ms.total > result.slowestMs) { result.slowestMs = Math.round(report.ms.total); result.slowest = map.code + ' ' + size.id; }
      result.slowestBuildMs = Math.max(result.slowestBuildMs, Math.round(buildMs));
    }
    return result;
  },
});
