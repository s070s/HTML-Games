## Appendix A. Specification coverage map

This appendix lists every numbered section and subsection of the four specification parts
(B 1-29, E 1-13, I 1-21, P 1-22) and names where this plan covers it. The E and P parts
also get a "preamble" row for their unnumbered opening instructions, because Part 15 numbers
those obligations `R-E0-nn` and `R-P0-nn`. How to read a row:

- Plan sections: plan section numbers (`Part.sub` or `Part.sub.subsub`; a bare number such
  as `8` means the whole part; `B.4`, `C.1`, `D.3` are appendix sections). They are listed in
  this order: design, roadmap and release sections in document order (Parts 0-11, 13 and
  14, then Appendices B-D; chosen from the explicit spec citations in those parts, with
  Part 6 module designs cited at the `6.N.7 Spec coverage` or `6.N.4 Algorithms` level),
  then the most relevant Part 12 test section, then the Part 15
  traceability section that holds the section's `R-` rows (`15.1.N` for B N, `15.2.N` for
  E N, `15.3` for I, `15.4` for P), then the Part 12 acceptance-test section that holds the
  `AT-<R-ID>` rows (`12.12.1` for B 1-12, `12.12.2` for B 13-29, `12.13.1` E, `12.13.2` I,
  `12.13.3` P). The AT section is omitted only where the section has no P0 or P1 row.
- T sections: the Part 11 entries whose `Covers:` list contains an R-ID of exactly that
  spec section (read from the `parts/11x-index-*.txt` files). A parent row whose
  obligations all sit in its subsections says "plus rows X a.b-a.c"; when the parent also has
  its own R-IDs, its T entries come first. To execute or check a spec section, read its
  plan sections, then work the T entries in T order.
- Part 14 is cited by the subsection numbers fixed for it: 14.1 delivery checklist, 14.2
  polish gates (one table per P section), 14.3 release-blocking gate summary, 14.4
  `docs/COMPATIBILITY.md` template, 14.5 `docs/FINAL-REPORT.md` template, 14.6 dependency
  and license inventory, 14.7 known limitations, 14.8 launch and usage instructions, 14.9
  relay deployment instructions.

### A.1 Base specification (B, FLM-1.0)

| Spec part | Section | Title | Plan sections | T sections |
|---|---|---|---|---|
| B | 1 | Mandatory Instructions for the Implementing Agent | 0.2, 0.6, 0.7, 0.8, 15.1.1, 12.12.1 | plus rows B 1.1-1.5 |
| B | 1.1 | Specification-first workflow | 0.2, 0.4, 11, 11.0 | T00.01 |
| B | 1.2 | Required planning artifacts | 0.2, 2, 4.2, 5, 7, 8, 9, 10, 11.0, 12, 13, 14, 15 | T00.01 T00.02 T00.04 T00.05 T00.06 |
| B | 1.3 | Planning approval gate | 0.6, 3.8, 11.0 | T00.07 |
| B | 1.4 | Implementation discipline | 0.4, 0.5, 0.6, 0.7, 15.1.1, 12.12.1 | T01.05 T01.12 |
| B | 1.5 | Definition of completion | 0.8, 12.10, 14.7, 15.1.1, 12.12.1 | T15.05 T16.01 T16.02 T16.03 T16.06 |
| B | 2 | Product Vision | 1.1, 1.2, 1.3, 15.1.2, 12.12.1 | T01.02 T01.06 T03.05 T05.05 T06.06 T08.04 T08.06 T09.05 T09.06 T09.10 T10.04 T11.08 T13.01 |
| B | 3 | Product Principles | 0.8, 1.1, 1.4, 8.9.3, 12.4.2, 15.1.3, 12.12.1 | plus rows B 3.1-3.7 |
| B | 3.1 | Musical accuracy | 1.1, 6.3.7, 15.1.3, 12.12.1 | T07.02 |
| B | 3.2 | Playability | 1.1, 6.8.4, 7.2, 15.1.3, 12.12.1 | T03.05 T06.03 |
| B | 3.3 | Visual responsiveness | 6.20.4, 6.21.4, 10.5.1, 15.1.3, 12.12.1 | T05.05 |
| B | 3.4 | Accessibility across devices | 6.7.4, 10.5.2, 15.1.3, 12.12.1 | T03.02 |
| B | 3.5 | Faithful import | 1.1, 6.14.4, 8.9.3, 12.4.2, 15.1.3, 12.12.1 | T07.02 T07.03 |
| B | 3.6 | Honest technical limits | 0.8, 1.5, 7.6.14, 8.1.4, 15.1.3, 12.12.1 | T07.03 |
| B | 3.7 | Single-file delivery | 1.4, 2.1, 2.18, 15.1.3, 12.12.1 | T01.01 T13.08 |
| B | 4 | Scope and Feature Priorities | 0.2, 0.9.4, 1.3, 6.23.1, 15.1.4, 12.12.1 | plus rows B 4.1-4.4 |
| B | 4.1 | Priority levels | 0.2, 0.9.4, 15.1.4, 12.12.1 | T00.06 T00.09 |
| B | 4.2 | P0 - Core experience | 0.9.4, 1.3, 6.31.7, 15.1.4, 12.12.1 | T01.01 T01.06 T03.05 T03.09 T04.06 T05.05 T05.07 T06.01 T06.05 T06.06 T07.06 T08.04 T09.10 T10.04 T15.01 |
| B | 4.3 | P1 - Full product | 0.9.4, 1.3, 15.1.4, 12.12.1 | T05.05 T07.02 T09.05 T09.10 T10.01 T11.01 T11.02 T12.02 T12.04 T12.06 T13.01 T14.01 T14.04 T14.06 |
| B | 4.4 | P2 - Advanced features | 0.9.4, 1.3, 6.23.1, 15.1.4 | T03.02 T03.11 T11.07 T11.10 T11.12 T12.07 T12.09 T13.11 T14.08 |
| B | 5 | Platform and Deployment Requirements | 0.8, 1.1, 1.4, 1.6, 15.1.5, 12.12.1 | plus rows B 5.1-5.4 |
| B | 5.1 | Supported environments | 1.6, 9.2.1, 15.1.5, 12.12.1 | T15.04 |
| B | 5.2 | Standalone operation | 0.8, 2.1, 2.18, 6.29.7, 15.1.5, 12.12.1 | T01.10 T15.03 T15.04 |
| B | 5.3 | Single-file packaging | 0.8, 2.2, 15.1.5, 12.12.1 | T00.02 T01.01 T01.02 T04.10 T13.03 |
| B | 5.4 | Required distinction: standalone versus online | 0.6, 0.8, 1.4, 2.7, 15.1.5, 12.12.1 | T01.10 T13.03 T13.08 T13.09 |
| B | 6 | User Experience and Navigation | 4.3, 6.27.7, 7.6.0, 7.9.1, 15.1.6, 12.12.1 | plus rows B 6.1-6.4 |
| B | 6.1 | First launch | 4.3, 6.27.4, 7.6.1, 7.9.1, 15.1.6, 12.12.1 | T01.04 T01.10 T01.11 T03.04 T04.01 |
| B | 6.2 | Main menu | 1.2, 2.18, 4.3, 7.6.2, 15.1.6, 12.12.1 | T01.11 T03.04 T06.06 T07.09 T08.05 T09.05 T10.04 T11.08 T13.09 |
| B | 6.3 | Shared interface elements | 2.13, 6.26.7, 6.27.7, 7.6.0, 15.1.6, 12.12.1 | T01.06 T01.09 T02.08 T03.02 T04.02 T05.03 T06.01 T06.06 T07.09 |
| B | 6.4 | Responsive layout | 2.13, 6.21.4, 6.26.4, 6.26.7, 15.1.6, 12.12.1 | T01.06 T02.08 T03.02 T08.04 T09.08 |
| B | 7 | Core Gameplay Modes | 6.8.7, 6.27.4, 6.27.7, 6.28.7, 15.1.7, 12.12.1 | plus rows B 7.1-7.7 |
| B | 7.1 | Quick Play | 2.14, 6.27.7, 6.28.7, 7.6.3, 15.1.7, 12.12.1 | T08.05 T11.08 |
| B | 7.2 | Instrument Rhythm Mode | 6.8.7, 6.9.7, 6.27.7, 6.28.7, 15.1.7, 12.12.1 | T03.01 T08.01 T08.02 T08.04 T08.06 |
| B | 7.3 | Free Play | 6.7.7, 6.8.4, 6.27.4, 7.6.5, 15.1.7, 12.12.1 | T06.01 T06.02 T06.03 T06.05 T06.06 |
| B | 7.4 | Studio Mode | 6.15.1, 6.15.7, 6.17.1, 7.6.6, 15.1.7, 12.12.1 | T09.02 T09.05 T09.06 T09.08 T09.09 T09.10 |
| B | 7.5 | Imported Song Mode | 6.4.7, 6.8.1, 6.8.7, 6.9.7, 15.1.7, 12.12.1 | T02.04 T07.06 T07.08 T07.09 T08.01 T08.04 T08.06 |
| B | 7.6 | Dance Mode | 6.9.7, 6.21.7, 6.23.7, 6.27.4, 15.1.7, 12.12.1 | T11.01 T11.02 T11.03 T11.04 T11.05 T11.06 T11.08 |
| B | 7.7 | Multiplayer | 1.5, 2.7, 6.24.7, 6.27.4, 15.1.7, 12.12.1 | T13.01 T13.03 T13.04 T13.05 T13.06 T13.07 T13.09 T13.11 |
| B | 8 | Four-Button Input and Musical Mapping | 1.7, 6.7.1, 6.7.7, 6.8.7, 15.1.8, 12.12.1 | plus rows B 8.1-8.5 |
| B | 8.1 | Input abstraction | 2.10, 6.7.1, 6.7.7, 15.1.8, 12.12.1 | T03.01 T03.02 |
| B | 8.2 | Default controls | 6.7.1, 6.7.7, 6.26.7, 9.8, 15.1.8, 12.12.1 | T03.02 T03.04 |
| B | 8.3 | Mapping profiles | 0.9.6, 6.8.1, 6.8.7, B.3, 15.1.8, 12.12.1 | T03.05 |
| B | 8.4 | Chord and polyphony behavior | 6.7.7, 6.8.7, 7.6.5, 15.1.8, 12.12.1 | T03.03 T03.06 T08.01 |
| B | 8.5 | Input calibration | 6.7.7, 6.9.7, 6.27.7, 7.7.1, 15.1.8, 12.12.1 | T03.04 T03.06 T03.07 |
| B | 9 | Rhythm Engine and Scoring | 1.1, 6.9.4, 6.9.7, 6.21.7, 12.5, 15.1.9, 12.12.1 | plus rows B 9.1-9.4 |
| B | 9.1 | Musical event timeline | 2.5, 6.3.7, 6.4.7, 6.9.7, 12.5, 15.1.9, 12.12.1 | T02.02 T02.03 T02.04 T02.05 |
| B | 9.2 | Scheduling | 2.5, 4.5, 6.4.7, 6.21.7, 15.1.9, 12.12.1 | T04.04 T05.03 |
| B | 9.3 | Judgments | 6.9.1, 6.9.4, 6.9.7, 6.21.7, 15.1.9, 12.12.1 | T03.07 |
| B | 9.4 | Scoring | 5.11, 6.9.1, 6.9.4, 6.9.7, 15.1.9, 12.12.1 | T03.07 T03.08 T13.06 |
| B | 10 | Music Theory and Configuration | 6.2.7, 6.3.7, 6.8.4, 6.8.7, 12.5, 15.1.10, 12.12.1 | plus rows B 10.1-10.5 |
| B | 10.1 | Musical keys | 5.1.4, 6.2.4, 6.2.7, 15.1.10, 12.12.1 | T02.01 |
| B | 10.2 | Scales | 6.2.4, 6.2.7, 7.6.5, 15.1.10, 12.12.1 | T03.06 T06.01 |
| B | 10.3 | Chords and intervals | 6.2.4, 6.2.7, 6.8.4, 15.1.10, 12.12.1 | T03.06 |
| B | 10.4 | Scale mapping | 6.2.7, 6.8.4, 6.8.7, 15.1.10, 12.12.1 | T03.06 T06.03 |
| B | 10.5 | Tempo and meter | 6.3.7, 6.30.7, 12.5, 15.1.10, 12.12.1 | T02.03 T06.01 |
| B | 11 | Audio Engine | 1.1, 2.4, 6.5.7, 6.6.7, 12.4.2, 15.1.11, 12.12.1 | plus rows B 11.1-11.6 |
| B | 11.1 | General requirements | 2.4, 6.5.7, 15.1.11, 12.12.1 | T04.02 T04.06 T04.11 T06.02 T06.04 T06.05 T07.06 T08.04 T12.07 |
| B | 11.2 | Audio implementation | 2.4, 6.5.7, 6.6.7, 15.1.11, 12.12.1 | T00.02 T04.01 T04.02 T04.03 T04.04 T04.06 |
| B | 11.3 | General MIDI fidelity | 2.4, 6.2.7, 6.6.7, 15.1.11, 12.12.1 | T04.06 T04.07 T14.01 |
| B | 11.4 | Instrument behavior | 2.4, 5.2, 6.6.7, 6.30.7, 12.4.2, 15.1.11, 12.12.1 | T04.02 T04.06 T07.05 |
| B | 11.5 | Audio recording | 2.4, 6.17.1, 6.17.7, 7.6.6, 12.4.2, 15.1.11, 12.12.1 | T06.05 T08.04 T09.10 |
| B | 11.6 | Audio performance | 2.4, 6.5.7, 9.6.4, 9.9, 15.1.11, 12.12.1 | T04.03 T04.04 T12.07 T14.02 T14.07 |
| B | 12 | 3D Rendering and Performance Visualization | 2.3, 6.18.7, 6.20.7, 6.21.7, 12.5, 15.1.12, 12.12.1 | plus rows B 12.1-12.7 |
| B | 12.1 | Stage | 2.3, 6.18.7, 6.21.7, B.4, 15.1.12, 12.12.1 | T05.02 T05.07 |
| B | 12.2 | Humanoid avatars | 2.3, 6.19.7, B.4, 15.1.12, 12.12.1 | T05.04 |
| B | 12.3 | Instrument performance animation | 2.3, 6.20.7, 15.1.12, 12.12.1 | T05.05 |
| B | 12.4 | Abstract visualization | 2.3, 6.20.7, 6.21.7, 9.3.1, 15.1.12, 12.12.1 | T05.06 |
| B | 12.5 | Polyphonic visualization | 2.3, 6.20.7, 6.21.7, 15.1.12, 12.12.1 | T05.05 T05.07 |
| B | 12.6 | Rendering architecture | 2.3, 6.18.7, 6.20.7, 12.5, 15.1.12, 12.12.1 | T00.02 T05.01 T05.02 T05.04 T05.05 T05.11 |
| B | 12.7 | Performance fallback | 2.3, 6.18.4, 6.18.7, 6.28.7, 15.1.12, 12.12.1 | T05.03 T14.04 |
| B | 13 | Character Customization | 6.19.7, 6.22.7, 6.27.4, 7.6.11, 12.4.2, 15.1.13, 12.12.2 | plus rows B 13.1-13.4 |
| B | 13.1 | Customization screen | 6.22.7, 6.27.7, 6.30.7, 15.1.13, 12.12.2 | T10.02 T10.03 T10.04 |
| B | 13.2 | Data-driven appearance | 5.10, 6.22.4, 6.22.7, 15.1.13, 12.12.2 | T10.01 |
| B | 13.3 | Rig compatibility | 6.19.7, 6.22.7, 15.1.13, 12.12.2 | T10.01 T10.02 |
| B | 13.4 | Persistence | 6.21.7, 6.22.4, 6.22.7, 6.24.7, 12.4.2, 15.1.13, 12.12.2 | T10.05 T13.05 |
| B | 14 | Dance System | 6.7.7, 6.9.7, 6.23.7, 7.6.9, 15.1.14, 12.12.2 | plus rows B 14.1-14.4 |
| B | 14.1 | Dance chart model | 5.9.3, 6.23.4, 6.23.7, 15.1.14, 12.12.2 | T11.01 |
| B | 14.2 | Gameplay | 6.9.7, 6.21.7, 6.23.7, 15.1.14, 12.12.2 | T11.02 T11.04 T11.08 |
| B | 14.3 | Choreography visualization | 6.20.7, 6.23.4, 6.23.7, 15.1.14, 12.12.2 | T11.05 |
| B | 14.4 | Input independence | 6.7.7, 6.9.7, 6.23.1, 6.23.7, 15.1.14, 12.12.2 | T11.03 T11.04 |
| B | 15 | File Import and Export | 1.1, 2.6, 6.10.7, 8.9.3, 12.4.2, 15.1.15, 12.12.2 | plus rows B 15.1-15.7 |
| B | 15.1 | Import architecture | 2.6, 6.10.1, 8.1, 8.1.1, 15.1.15, 12.12.2 | T07.03 T07.08 T07.09 |
| B | 15.2 | MIDI | 2.6, 6.2.7, 6.10.4, 6.10.7, 12.4.2, 15.1.15, 12.12.2 | T07.01 T07.02 T07.03 |
| B | 15.3 | MusicXML | 1.5, 8.4.1, 8.4.2, 8.9.3, 12.4.2, 15.1.15, 12.12.2 | T12.01 T12.02 T12.03 |
| B | 15.4 | Guitar Pro | 2.6, 6.13.7, 8.5.1, 8.9.3, 12.4.2, 15.1.15, 12.12.2 | T12.04 T12.05 T12.08 |
| B | 15.5 | Additional formats | 1.5, 2.6, 6.14.7, 8.6, 12.4.2, 15.1.15, 12.12.2 | T12.06 T12.07 T12.09 |
| B | 15.6 | Export | 6.10.7, 6.16.1, 8.11, 8.11.3, 12.4.2, 15.1.15, 12.12.2 | T09.10 T10.03 T11.06 |
| B | 15.7 | Internal music representation | 6.3.7, 6.10.7, 6.12.7, 6.13.7, 15.1.15, 12.12.2 | T02.02 T02.03 T06.05 T08.01 T09.01 |
| B | 16 | Recording and Multitrack Studio | 6.17.1, 6.17.7, 6.27.4, 6.27.7, 12.5, 15.1.16, 12.12.2 | plus rows B 16.1-16.5 |
| B | 16.1 | Track lifecycle | 6.15.7, 6.17.7, 15.1.16, 12.12.2 | T09.05 T09.09 |
| B | 16.2 | Recording workflow | 6.4.7, 6.17.1, 6.17.7, 12.5, 15.1.16, 12.12.2 | T09.06 |
| B | 16.3 | Layering | 6.17.1, 6.17.7, 9.6.5, 9.6.6, 15.1.16, 12.12.2 | T09.06 |
| B | 16.4 | Editing | 6.15.1, 6.15.7, 6.17.1, 6.17.7, 15.1.16, 12.12.2 | T09.02 T09.08 |
| B | 16.5 | Mixing | 1.5, 6.5.7, 6.17.1, 6.17.7, 15.1.16, 12.12.2 | T04.02 T09.09 T14.03 T14.08 |
| B | 17 | Multiplayer Architecture | 6.24.7, 6.27.4, 6.27.7, 7.6.10, 15.1.17, 12.12.2 | plus rows B 17.1-17.5 |
| B | 17.1 | Client-server separation | 1.4, 6.24.7, 15.1.17, 12.12.2 | T13.01 T13.08 |
| B | 17.2 | Synchronization model | 2.7, 6.24.1, 6.24.3, 6.24.7, 15.1.17, 12.12.2 | T13.01 T13.04 T13.07 |
| B | 17.3 | Network resilience | 1.5, 6.24.7, 15.1.17, 12.12.2 | T13.02 T13.07 T13.08 T13.11 |
| B | 17.4 | Security | 2.7, 2.12, 5.16, 6.24.1, 15.1.17, 12.12.2 | T07.01 T13.02 T13.06 |
| B | 17.5 | Standalone behavior | 1.4, 6.24.7, 15.1.17, 12.12.2 | T13.09 |
| B | 18 | Data Persistence and Project Format | 2.8, 6.15.1, 6.15.7, 6.16.7, 12.4.2, 15.1.18, 12.12.2 | plus rows B 18.1-18.4 |
| B | 18.1 | Local persistence | 2.8, 6.15.7, 6.16.1, 6.16.7, 15.1.18, 12.12.2 | T00.02 T09.03 |
| B | 18.2 | Project contents | 2.8, 6.15.1, 6.15.7, 12.4.2, 15.1.18, 12.12.2 | T09.01 T10.05 T11.06 T12.07 |
| B | 18.3 | Versioning | 2.8, 6.15.1, 6.15.7, 6.16.7, 12.4.2, 15.1.18, 12.12.2 | T09.12 |
| B | 18.4 | Storage limits | 2.8, 6.15.7, 6.16.1, 6.16.7, 15.1.18, 12.12.2 | T09.03 |
| B | 19 | Technical Architecture | 1.8, 2.9, 2.17, 6.1.7, 15.1.19, 12.12.2 | plus rows B 19.1-19.5 |
| B | 19.1 | Architectural layers | 4.1, 4.2, 6.1.7, 15.1.19, 12.12.2 | T01.01 T01.04 T01.05 T01.08 T02.02 T02.04 T03.01 T03.05 T03.07 T04.01 T05.01 T05.05 T07.05 T09.03 T09.06 T10.05 T11.08 T13.09 |
| B | 19.2 | Module boundaries | 4.1, 4.4, 4.6, 6.4.7, 6.20.1, 15.1.19, 12.12.2 | T01.01 T02.02 T02.04 T03.01 T03.05 T03.07 T04.04 T05.03 T05.05 T09.01 |
| B | 19.3 | Technology evaluation | 2.2, 2.3, 2.4, 2.6, 2.17, 15.1.19, 12.12.2 | T00.02 |
| B | 19.4 | Single-file source organization | 1.8, 2.9, 3.3.3, 6.1.7, 15.1.19, 12.12.2 | T01.01 |
| B | 19.5 | Dependency policy | 2.17, 6.11.7, 15.1.19, 12.12.2 | T00.02 |
| B | 20 | Performance and Resource Management | 2.6, 6.18.7, 9.1.2, 9.5, 12.9.2, 15.1.20, 12.12.2 | plus rows B 20.1-20.4 |
| B | 20.1 | Performance targets | 9.1.2, 9.1.4, 9.2.1, 12.9.2, 15.1.20, 12.12.2 | T01.02 T03.01 T04.03 T04.04 T09.01 T09.05 T13.02 T14.04 T14.05 T14.07 T15.06 |
| B | 20.2 | Rendering targets | 6.18.7, 9.8, 15.1.20, 12.12.2 | T14.04 |
| B | 20.3 | Resource cleanup | 6.1.7, 6.18.7, 6.28.7, 9.5, 15.1.20, 12.12.2 | T01.03 T04.05 T05.11 T06.05 T07.03 T12.07 T13.07 T14.07 |
| B | 20.4 | Loading strategy | 2.6, 2.17, 7.1.7, 7.6.8, 15.1.20, 12.12.2 | T01.06 T01.10 |
| B | 21 | Mobile-Specific Requirements | 6.4.7, 6.5.7, 9.8, 10.8, 12.8.11, 15.1.21, 12.12.2 | plus rows B 21.1-21.4 |
| B | 21.1 | Touch input | 6.7.7, 6.26.7, 7.5.2, 9.8, 15.1.21, 12.12.2 | T03.02 |
| B | 21.2 | Audio activation | 6.5.7, 6.29.7, 15.1.21, 12.12.2 | T04.01 |
| B | 21.3 | Mobile performance | 6.18.7, 9.3.6, 9.8, 15.1.21, 12.12.2 | T14.02 T14.04 T14.06 |
| B | 21.4 | Interruptions | 6.4.7, 6.5.7, 9.8, 10.8, 12.8.11, 15.1.21, 12.12.2 | T14.06 |
| B | 22 | Accessibility and Usability | 2.3, 2.13, 7.10, 10.5.1, 15.1.22, 12.12.2 | T01.04 T01.07 T03.04 T05.06 T05.07 T08.02 T08.03 |
| B | 23 | Security, Privacy, and Licensing | 1.8, 2.7, 6.24.1, 8.9.3, 12.4.2, 15.1.23, 12.12.2 | plus rows B 23.1-23.4 |
| B | 23.1 | File safety | 6.10.7, 6.11.1, 6.11.7, 8.9.3, 12.4.2, 15.1.23, 12.12.2 | T07.01 T07.03 |
| B | 23.2 | Privacy | 1.8, 2.7, 2.15, 3.7.5, 15.1.23, 12.12.2 | T01.10 T13.09 |
| B | 23.3 | Licensing | 1.8, 6.30.7, 14.6, 15.1.23, 12.12.2 | T16.05 |
| B | 23.4 | Online service credentials | 2.7, 3.7.2, 6.24.1, 6.24.7, 15.1.23, 12.12.2 | T13.08 |
| B | 24 | Error Handling and Diagnostics | 6.1.7, 6.5.7, 6.14.7, 10.10, 12.7.1, 15.1.24, 12.12.2 | T01.04 T01.10 T01.11 T04.01 T04.11 T05.01 T07.03 T09.04 T09.10 T09.11 T09.12 T13.09 T14.04 |
| B | 25 | Testing Strategy | 1.6, 6.31.7, 8.9.3, 8.9.6, 12.5, 15.1.25, 12.12.2 | plus rows B 25.1-25.7 |
| B | 25.1 | Unit tests | 6.10.7, 6.23.7, 6.31.7, 12.2.32, 15.1.25, 12.12.2 | T01.04 T02.03 T03.01 T03.05 T03.06 T03.08 T04.04 T07.04 T09.01 T09.12 T11.06 T11.11 |
| B | 25.2 | Integration tests | 6.23.7, 6.24.7, 6.31.7, 12.3.3, 15.1.25, 12.12.2 | T03.08 T04.08 T07.06 T07.07 T09.07 T09.09 T10.05 T11.11 T13.10 |
| B | 25.3 | File-format tests | 6.10.7, 6.12.7, 8.9.3, 8.9.6, 12.4.2, 15.1.25, 12.12.2 | T07.04 T12.02 T12.04 T12.08 |
| B | 25.4 | Timing tests | 3.4, 4.5, 6.31.7, 12.5, 15.1.25, 12.12.2 | T02.07 T03.07 T04.04 T05.11 T14.06 |
| B | 25.5 | Cross-device tests | 1.6, 6.31.7, 9.2.1, 12.1.1, 15.1.25, 12.12.2 | T15.04 |
| B | 25.6 | Performance tests | 6.31.7, 9.6, 9.6.2, 9.6.5, 12.1.1, 15.1.25, 12.12.2 | T14.02 T14.04 T14.05 T14.07 |
| B | 25.7 | Acceptance tests | 0.8, 6.31.7, 12.1.1, 15.1.25, 12.12.2 | T15.01 |
| B | 26 | Acceptance Criteria | 0.8, 1.1, 6.10.7, 6.28.7, 12.10.3, 15.1.26, 12.12.2 | plus rows B 26.1-26.8 |
| B | 26.1 | Standalone application | 1.4, 2.18, 6.29.7, 15.1.26, 12.12.2 | T15.03 T15.04 T16.01 |
| B | 26.2 | Instrument gameplay | 6.8.4, 6.9.4, 6.28.7, 12.5, 15.1.26, 12.12.2 | T08.01 T08.02 T15.05 |
| B | 26.3 | Music playback | 1.1, 6.10.7, 6.14.7, 6.28.7, 12.5, 15.1.26, 12.12.2 | T07.05 T07.06 |
| B | 26.4 | Visualization | 6.18.7, 6.20.7, 6.21.7, 6.28.7, 15.1.26, 12.12.2 | T07.07 T14.04 |
| B | 26.5 | Recording and studio | 6.15.4, 6.17.4, 6.27.4, 12.4.2, 15.1.26, 12.12.2 | T09.03 T09.06 T09.10 |
| B | 26.6 | Dance mode | 6.23.1, 6.23.4, 6.23.7, 15.1.26, 12.12.2 | T11.01 T11.02 T11.04 T11.05 T11.11 |
| B | 26.7 | Multiplayer | 6.24.4, 6.24.7, 12.7.1, 15.1.26, 12.12.2 | T13.04 T13.07 T13.09 T13.10 |
| B | 26.8 | Delivery | 7.6.14, 10.3, 14.1, 12.10.3, 15.1.26, 12.12.2 | T16.01 T16.05 T16.06 T16.07 T16.08 |
| B | 27 | Implementation Roadmap (Phases 0-16) | 1.3, 2.19, 9.1.2, 11.0, B.9, D.3, 12.1.5, 15.1.27, 12.12.2 | T00.01 T00.07 T00.08 T00.09 T01.12 T02.09 T03.12 T04.12 T05.12 T06.07 T07.10 T08.08 T09.14 T10.07 T11.08 T11.13 T12.10 T13.01 T13.12 T14.09 T15.01 T15.08 T16.10 |
| B | 28 | Final Implementation Report | 0.8, 9.1.4, 9.2.3, 14.5, 14.8, 14.9, 12.11, 15.1.28, 12.12.2 | T16.01 T16.03 T16.05 T16.06 T16.07 T16.08 |
| B | 29 | Final Product Definition | 1.1, 4.6, 15.1.29, 12.12.2 | T00.01 T00.07 T01.01 T05.05 T07.02 T13.01 T14.04 T15.03 T15.05 T16.02 |

### A.2 Edge cases and critical failure modes (E, FLM-1.1.0)

| Spec part | Section | Title | Plan sections | T sections |
|---|---|---|---|---|
| E | preamble | Preamble (unnumbered): extension statement | 0.2, 11.0, 15.2.0, 12.13.1 | T00.01 T00.06 |
| E | 1 | Highest-impact risks | 6.1.7, 6.5.7, 6.7.7, 6.16.4, 13.1, 13.2, 15.2.1, 12.13.1 | T00.05 T01.02 T01.04 T01.09 T03.03 T04.01 T04.03 T04.04 T04.05 T07.02 T07.03 T09.03 T12.08 T13.01 |
| E | 2 | Audio engine and musical timing edge cases | 2.4, 6.5.5, 6.5.7, 10.8, 12.5, 15.2.2, 12.13.1 | T04.08; plus rows E 2.1-2.3 |
| E | 2.1 | Audio lifecycle | 2.4, 6.5.5, 10.8, 12.7.1, 15.2.2, 12.13.1 | T04.01 T04.05 T04.08 T06.05 T12.07 |
| E | 2.2 | Timing and scheduling | 2.4, 2.5, 6.4.7, 6.5.5, 12.5, 15.2.2, 12.13.1 | T02.03 T02.04 T02.05 T03.01 T04.03 T04.04 |
| E | 2.3 | Stuck notes and voice management | 2.4, 6.3.4, 6.3.7, 6.5.4, 12.5, 15.2.2, 12.13.1 | T02.02 T04.03 T04.05 T06.04 |
| E | 3 | MIDI and music-file edge cases | 2.6, 8.3.4, 8.9.3, 8.9.4, 12.4.2, 15.2.3, 12.13.1 | T07.04; plus rows E 3.1-3.4 |
| E | 3.1 | MIDI structural cases | 2.6, 8.3.4, 8.9.3, 8.9.4, 12.4.2, 15.2.3, 12.13.1 | T07.01 T07.02 T07.03 |
| E | 3.2 | Musical interpretation cases | 2.5, 2.6, 8.3.4, 8.9.3, 12.4.2, 15.2.3, 12.13.1 | T07.02 T07.05 T07.08 |
| E | 3.3 | MusicXML and Guitar Pro cases | 2.6, 8.4.4, 8.5.3, 8.9.3, 12.4.2, 15.2.3, 12.13.1 | T12.01 T12.02 T12.03 T12.04 T12.05 T12.06 T12.08 |
| E | 3.4 | Imported audio files | 1.5, 8.6, 8.6.3, 8.9.3, 12.4.2, 15.2.3, 12.13.1 | T12.07 |
| E | 4 | Four-button input and scoring edge cases | 1.5, 2.10, 6.9.5, 6.9.7, 12.5, 15.2.4, 12.13.1 | plus rows E 4.1-4.2 |
| E | 4.1 | Input handling | 1.5, 2.10, 5.12, 6.7.1, 12.5, 15.2.4, 12.13.1 | T03.01 T03.02 T03.03 T03.09 T03.11 T13.09 |
| E | 4.2 | Scoring and mapping | 6.8.1, 6.8.5, 6.8.7, 6.9.1, 12.5, 15.2.4, 12.13.1 | T03.07 T08.01 T08.02 T08.04 |
| E | 5 | Studio, recording, and project persistence | 6.15.1, 6.15.7, 6.16.1, 6.17.4, 12.7.1, 15.2.5, 12.13.1 | plus rows E 5.1-5.3 |
| E | 5.1 | Recording | 6.4.7, 6.17.1, 6.17.4, 6.17.5, 12.5, 15.2.5, 12.13.1 | T06.05 T09.02 T09.06 T09.07 |
| E | 5.2 | Editing and mixing | 6.6.7, 6.15.1, 6.15.3, 6.17.4, 15.2.5, 12.13.1 | T09.02 T09.05 T09.08 T09.09 |
| E | 5.3 | Saving and loading | 2.8, 5.5, 6.15.1, 6.16.1, 12.7.1, 15.2.5, 12.13.1 | T09.01 T09.03 T09.04 T09.11 T09.12 |
| E | 6 | 3D visualization and avatar edge cases | 2.3, 6.19.7, 6.21.4, 6.21.7, 12.7.1, 15.2.6, 12.13.1 | plus rows E 6.1-6.2 |
| E | 6.1 | Animation accuracy | 2.3, 6.19.4, 6.19.7, 6.20.4, 15.2.6, 12.13.1 | T05.04 T05.05 T05.06 T10.02 |
| E | 6.2 | Rendering and resources | 2.3, 6.18.7, 6.19.7, 6.21.4, 12.7.1, 15.2.6, 12.13.1 | T05.01 T05.03 T05.09 T05.11 T10.05 T14.04 |
| E | 7 | Dance mode edge cases | 5.14.2, 6.23.1, 6.23.4, 6.23.5, 12.5, 15.2.7, 12.13.1 | T11.01 T11.02 T11.03 T11.04 T11.05 T11.06 T11.11 |
| E | 8 | Multiplayer edge cases | 2.7, 6.24.4, 6.24.5, 6.24.7, 12.7.1, 15.2.8, 12.13.1 | T13.01 T13.10; plus rows E 8.1-8.3 |
| E | 8.1 | Session management | 1.5, 2.7, 6.24.4, 6.24.5, 12.7.1, 15.2.8, 12.13.1 | T13.03 T13.05 T13.07 T13.08 T13.11 |
| E | 8.2 | Synchronization | 5.16, 6.24.3, 6.24.4, 6.24.5, 12.7.1, 15.2.8, 12.13.1 | T13.01 T13.02 T13.04 T13.05 T13.07 |
| E | 8.3 | Security and abuse | 2.7, 3.7.5, 6.22.4, 6.24.5, 15.2.8, 12.13.1 | T13.02 T13.03 T13.04 T13.05 T13.06 T13.07 T13.08 |
| E | 9 | Single-HTML-file and browser edge cases | 1.5, 1.6, 2.1, 2.2, 12.7.1, 15.2.9, 12.13.1 | T01.02 T01.04 T01.09 T01.10 T01.11 T03.02 T05.01 T07.09 T09.03 T14.05 T15.04 |
| E | 10 | Common architecture mistakes to prohibit | 0.5, 0.7, 1.1, 1.2, C.1, C.2, 15.2.10, 12.13.1 | T00.03 T01.01 T01.02 T01.05 T01.09 T01.10 T02.04 T03.05 T04.05 T04.06 T04.07 T04.10 T05.05 T09.10 T12.08 |
| E | 11 | Mandatory failure-recovery rules | 1.4, 2.3, 10.7, 10.7.11, 12.7.1, 15.2.11, 12.13.1 | T00.03 T01.04 T01.09 T04.08 T05.11 T07.09 T09.03 T09.07 T13.09 |
| E | 12 | Required additions to the pre-implementation table of contents | 0.2, 2.11, 2.16, 6.31.7, 11.0, 15.2.12, 12.13.1 | T00.01 T00.05 T00.06 T02.07 T03.03 T04.08 T05.11 T07.04 T08.02 T09.07 T09.12 T11.11 T12.08 T13.10 T15.02 T15.03 T15.04 T16.04 |
| E | 13 | Release-blocking acceptance gate | 0.8, 1.1, 6.10.7, 10.7.11, 14.3, 12.7.6, 15.2.13, 12.13.1 | T00.01 T16.02 T16.03 T16.04 |

### A.3 Essential product improvements (I, FLM-1.2.0)

| Spec part | Section | Title | Plan sections | T sections |
|---|---|---|---|---|
| I | 1 | Fix the core product architecture before expanding features | 1.1, 1.2, 6.4.7, 6.28.7, 15.3, 12.13.2 | plus rows I 1.1-1.3 |
| I | 1.1 | Create one unified musical engine | 1.1, 1.2, 2.5, 6.3.7, 15.3, 12.13.2 | T02.06 |
| I | 1.2 | Separate musical data from gameplay mappings | 6.15.1, 6.15.7, 8.3.4, 8.10.2, 15.3, 12.13.2 | T08.01 |
| I | 1.3 | Separate audio, rendering, and animation clocks | 4.5, 6.4.7, 6.8.9, 6.9.7, 6.9.9, 15.3, 12.13.2 | T04.04 T05.03 |
| I | 2 | Make the four-button gameplay genuinely musical | 6.7.7, 6.8.1, 6.8.7, 6.9.7, 15.3, 12.13.2 | T03.05; plus rows I 2.1-2.4 |
| I | 2.1 | Introduce a universal musical control system | 6.2.7, 6.7.7, 6.8.1, 6.8.7, 15.3, 12.13.2 | T03.04 T03.05 |
| I | 2.2 | Add adaptive difficulty that preserves musical intent | 6.8.1, 6.8.4, 6.8.7, 15.3, 12.13.2 | T08.01 |
| I | 2.3 | Make every input feel responsive | 2.10, 6.7.7, 6.9.7, 6.21.7, 15.3, 12.13.2 | T03.02 T03.03 T03.06 T03.07 T03.08 T03.09 |
| I | 2.4 | Add meaningful performance feedback | 6.9.1, 6.9.4, 6.9.7, 6.27.7, 15.3, 12.13.2 | T03.08 T08.06 |
| I | 3 | Upgrade the sound system from functional to convincing | 2.4, 6.5.7, 6.6.7, 10.10, 15.3, 12.13.2 | plus rows I 3.1-3.5 |
| I | 3.1 | Implement a layered instrument engine | 2.4, 6.6.7, 15.3, 12.13.2 | T04.06 T04.07 T14.08 |
| I | 3.2 | Add instrument-specific behavior | 2.4, 6.6.4, 6.6.7, 15.3, 12.13.2 | T04.06 T14.08 |
| I | 3.3 | Make mixing and playback reliable | 2.4, 6.5.7, 15.3, 12.13.2 | T04.02 T14.07 |
| I | 3.4 | Add a sound-quality system with explicit fidelity levels | 2.4, 6.6.2, 6.6.7, B.2, 15.3, 12.13.2 | T04.07 |
| I | 3.5 | Add audio diagnostics | 2.4, 6.27.4, 7.7.1, 10.10, 15.3, 12.13.2 | T03.09 T04.07 T04.09 |
| I | 4 | Make the 3D band a signature feature | 2.3, 6.19.7, 6.20.7, 6.21.7, 15.3, 12.13.2 | T05.05; plus rows I 4.1-4.4 |
| I | 4.1 | Build a reusable skeletal animation system | 2.3, 6.19.7, 15.3, 12.13.2 | T05.04 T05.05 |
| I | 4.2 | Map musical events to instrument-specific actions | 2.3, 6.20.7, 15.3, 12.13.2 | T05.05 T05.06 |
| I | 4.3 | Add a performance director | 2.3, 6.20.7, 6.21.7, 15.3, 12.13.2 | T05.08 |
| I | 4.4 | Improve the visualizer with musical context | 2.3, 6.20.7, 6.21.4, 6.21.7, 15.3, 12.13.2 | T05.05 T05.06 T05.07 T05.08 |
| I | 5 | Turn the studio into a usable creative tool | 6.15.1, 6.15.7, 6.17.1, 7.6.6, 15.3, 12.13.2 | T06.02 T09.02 T09.05 T09.06 T09.08 T09.10; plus rows I 5.1-5.3 |
| I | 5.1 | Introduce a non-destructive editing model | 6.15.1, 6.15.7, 6.17.4, 6.17.7, 15.3, 12.13.2 | T09.02 |
| I | 5.2 | Add a song arrangement overview | 6.17.7, 7.6.6, 15.3, 12.13.2 | T09.08 |
| I | 5.3 | Add a project recovery system | 2.8, 6.15.1, 6.15.7, 6.16.7, 15.3, 12.13.2 | T09.11 T09.13 |
| I | 6 | Make imported music work reliably | 2.6, 6.27.4, 7.6.8, 8.10, 12.2.27, 15.3, 12.13.2 | plus rows I 6.1-6.4 |
| I | 6.1 | Add an import inspection screen | 6.27.4, 6.27.8, 7.6.8, 8.10, 12.2.27, 15.3, 12.13.2 | T07.08 |
| I | 6.2 | Add an automatic playable-chart generator | 6.8.1, 6.27.4, 8.10, 8.10.3, 15.3, 12.13.2 | T07.08 |
| I | 6.3 | Add track isolation and practice tools | 1.2, 2.6, 6.23.4, 8.12, 12.5, 15.3, 12.13.2 | T08.04 T11.09 |
| I | 6.4 | Publish an honest compatibility matrix | 0.8, 1.8, 2.6, 6.10.1, 8.7, 14.4, 15.3, 12.13.2 | T12.08 |
| I | 7 | Make dance mode feel like a complete game mode | 1.3, 6.21.7, 6.23.1, 7.6.9, 15.3, 12.13.2 | T11.02 T11.03 T11.04 T11.05 T11.06 T11.08 T11.09 |
| I | 8 | Improve character customization and identity | 6.19.4, 6.19.7, 6.27.4, 7.6.11, 15.3, 12.13.2 | T10.02 T10.03 T10.04 T10.05 |
| I | 9 | Add a proper progression and reward system | 2.15, 6.25.1, 6.25.7, 6.27.7, 15.3, 12.13.2 | plus rows I 9.1-9.4 |
| I | 9.1 | Song and skill progression | 2.15, 6.25.1, 6.25.7, 15.3, 12.13.2 | T08.06 T11.10 |
| I | 9.2 | Performance history | 2.15, 6.25.1, 6.25.2, 6.25.4, 15.3, 12.13.2 | T08.06 |
| I | 9.3 | Unlockable cosmetics | 2.15, 6.22.7, 6.25.1, 6.25.3, 15.3, 12.13.2 | T11.07 T11.10 |
| I | 9.4 | Daily challenges | 2.15, 6.25.1, 6.25.7, 10.2, 15.3, 12.13.2 | T11.10 |
| I | 10 | Make multiplayer robust and meaningful | 2.7, 6.24.7, 6.27.4, 7.6.10, 15.3, 12.13.2 | T13.01; plus rows I 10.1-10.5 |
| I | 10.1 | Define three clear multiplayer experiences | 1.5, 2.7, 6.24.7, 15.3, 12.13.2 | T13.01 T13.05 T13.06 T13.11 |
| I | 10.2 | Add synchronization diagnostics | 2.7, 6.24.1, 6.24.3, 6.24.4, 15.3, 12.13.2 | T13.04 |
| I | 10.3 | Add robust session recovery | 2.7, 6.24.4, 6.24.7, 15.3, 12.13.2 | T13.07 |
| I | 10.4 | Protect shared projects | 1.5, 2.7, 6.24.7, 15.3, 12.13.2 | T13.01 T13.11 |
| I | 10.5 | Keep multiplayer optional | 2.7, 6.24.7, 10.2, 15.3, 12.13.2 | T13.09 |
| I | 11 | Improve the interface and onboarding | 2.13, 6.27.7, 7.2, 7.3, 15.3, 12.13.2 | plus rows I 11.1-11.4 |
| I | 11.1 | Introduce three levels of complexity | 2.13, 6.27.7, 7.1.6, 7.2, 15.3, 12.13.2 | T08.07 |
| I | 11.2 | Use contextual controls | 2.13, 6.27.4, 6.27.7, 7.3, 15.3, 12.13.2 | T08.07 |
| I | 11.3 | Add an interactive tutorial | 1.2, 2.13, 2.14, 7.9.2, 15.3, 12.13.2 | T08.07 |
| I | 11.4 | Add clear loading and error states | 2.13, 6.14.7, 6.26.7, 6.27.7, 15.3, 12.13.2 | T01.04 T01.06 |
| I | 12 | Make mobile support a first-class design requirement | 6.7.7, 6.16.7, 6.26.7, 9.8, 12.8, 15.3, 12.13.2 | T01.05 T01.06 T01.10 T03.02 T03.03 T05.01 T08.04 T09.11 T14.04 T14.08 T15.05; plus rows I 12.1-12.2 |
| I | 12.1 | Establish device performance profiles | 6.18.7, 9.3, 9.3.6, 9.8, 15.3, 12.13.2 | T05.03 |
| I | 12.2 | Prevent resource exhaustion | 6.18.7, 9.6, 9.6.3, 9.8, 15.3, 12.13.2 | T14.02 |
| I | 13 | Add a professional reliability and recovery layer | 2.12, 6.1.7, 6.5.7, 10.9.3, 12.7.1, 15.3, 12.13.2 | T01.05 T01.09 T01.11 T04.05 T09.01 T09.02 T09.03 T09.07 T09.10 T09.11; plus rows I 13.1-13.2 |
| I | 13.1 | Introduce fault-injection testing | 2.11, 6.18.7, 10.9, 10.9.3, 12.7.1, 15.3, 12.13.2 | T15.02 |
| I | 13.2 | Add a bug reproduction report | 6.1.7, 6.27.4, 6.27.7, 10.10, 12.4.2, 15.3, 12.13.2 | T01.04 |
| I | 14 | Improve the single-file architecture without sacrificing quality | 1.4, 2.1, 2.2, 2.18, 15.3, 12.13.2 | T01.01; plus rows I 14.1-14.3 |
| I | 14.1 | Use logical modules inside the HTML | 2.1, 2.18, 15.3, 12.13.2 | T01.01 T02.04 T03.05 T03.08 T04.04 T05.11 T07.10 T09.14 T10.01 T11.08 T11.11 T13.09 T13.10 |
| I | 14.2 | Establish a strict dependency budget | 2.2, 2.17, 2.18, 6.11.7, 15.3, 12.13.2 | T01.02 |
| I | 14.3 | Define two delivery profiles | 1.4, 2.18, 6.24.7, 6.29.7, 15.3, 12.13.2 | T13.08 T14.08 T16.01 T16.02 |
| I | 15 | Add accessibility and customization beyond appearance | 6.7.7, 6.21.7, 7.10, 10.5.1, 15.3, 12.13.2 | T01.07 T03.04 T05.03 T05.06 T05.07 T08.02 T08.03 T11.03 T11.08 |
| I | 16 | Make the game easier to extend | 6.3.7, 6.6.7, 6.14.7, 6.15.7, 15.3, 12.13.2 | plus rows I 16.1-16.4 |
| I | 16.1 | Use data-driven instrument definitions | 6.6.2, 6.6.3, 6.6.7, 15.3, 12.13.2 | T04.06 |
| I | 16.2 | Use adapters for music formats | 6.14.7, B.5, 15.3, 12.13.2 | T07.05 T12.06 |
| I | 16.3 | Use a consistent event system | 4.4, 6.3.7, 15.3, 12.13.2 | T02.06 |
| I | 16.4 | Version all persistent data | 6.15.7, 6.22.7, 6.23.7, 6.24.7, 15.3, 12.13.2 | T09.12 |
| I | 17 | Add automated quality gates | 0.7, 1.6, 1.8, 6.7.7, 12.1.7, 15.3, 12.13.2 | T01.05 T02.03 T03.03 T03.06 T04.04 T04.05 T05.11 T07.04 T08.02 T09.10 T09.14 T13.02 T13.10 T14.02 T15.01 T16.02 |
| I | 18 | Prioritize improvements by impact | 1.3, 11.0, 15.3, 12.13.2 | T00.03 T01.01 T03.10 T04.12 T05.10 T06.05 T08.04 T13.01 T13.11 T15.01 T15.04 |
| I | 19 | Add measurable product-quality targets | 6.9.7, 9.1, 9.1.2, 12.7.4, 15.3, 12.13.2 | T00.04 T03.08 T04.04 T04.05 T07.10 T09.03 T09.07 T13.04 T13.10 T14.04 T15.04 T16.01 T16.02 T16.03 T16.06 |
| I | 20 | Additional requirements for the pre-implementation table of contents | 0.2, 11.0, 15.3, 12.13.2 | T00.01 T00.04 T00.06 T01.02 T01.05 T01.07 T02.06 T04.07 T05.10 T07.05 T07.08 T08.01 T08.07 T09.02 T09.11 T10.06 T11.08 T13.01 T14.06 T16.09 |
| I | 21 | Final recommendation | 1.1, 1.2, 15.3, 12.13.2 | T02.06 T16.09 |

### A.4 Complete maximum-polish checklist (P, FLM-1.3.0)

| Spec part | Section | Title | Plan sections | T sections |
|---|---|---|---|---|
| P | preamble | Preamble (unnumbered): mandatory agent instruction | 0.2, 14.2, 15.0, 15.4, 12.13.3 | T00.01 T00.06 T16.03 |
| P | 1 | Overall game feel | 2.13, 6.26.1, 6.26.7, 10.5.2, 14.2, 15.4, 12.13.3 | T01.06 T01.08 T03.02 T08.05 T08.07 T09.13 T14.04 |
| P | 2 | Visual design and art direction | 2.13, 3.2.2, 6.18.9, 6.26.7, 14.2, 15.4, 12.13.3 | plus rows P 2.1-2.3 |
| P | 2.1 | Establish one recognizable visual identity | 3.2.2, 7.1.1, 14.2, 15.4, 12.13.3 | T01.06 T01.07 T05.07 T08.05 T10.04 |
| P | 2.2 | Pixel-level interface quality | 2.13, 6.18.9, 6.26.7, 7.1.4, 14.2, 15.4, 12.13.3 | T01.06 T05.02 T05.11 T15.07 T16.09 |
| P | 2.3 | Visual hierarchy | 3.2.2, 6.26.7, 7.1.2, 14.2, 15.4, 12.13.3 | T01.06 T01.08 |
| P | 3 | Main menu and navigation | 6.15.1, 6.26.4, 6.26.7, 7.6.2, 14.2, 15.4, 12.13.3 | T01.07 T01.09 T01.11 T09.04 T09.07 T09.13 T13.09 |
| P | 4 | First launch and onboarding | 1.7, 2.14, 6.27.4, 7.9.1, 14.2, 15.4, 12.13.3 | T01.04 T03.02 T04.01 T08.05 T08.07 |
| P | 5 | Gameplay responsiveness and feel | 2.10, 6.9.7, 6.27.4, 7.10.1, 14.2, 15.4, 12.13.3 | plus rows P 5.1-5.3 |
| P | 5.1 | Input quality | 2.10, 6.7.1, 6.7.7, 6.26.4, 14.2, 15.4, 12.13.3 | T03.01 T03.02 T03.03 T03.04 T03.05 T03.09 |
| P | 5.2 | Rhythm gameplay | 1.2, 2.10, 6.27.4, 7.6.18, 14.2, 15.4, 12.13.3 | T03.07 T03.08 T08.02 T08.03 T08.04 |
| P | 5.3 | Difficulty and fairness | 2.15, 5.11, 6.8.7, 7.10.1, 14.2, 15.4, 12.13.3 | T08.01 T10.06 T11.09 |
| P | 6 | Audio fidelity and sound quality | 2.4, 2.5, 6.5.7, 9.6.2, 14.2, 12.9.5, 15.4, 12.13.3 | T16.09; plus rows P 6.1-6.3 |
| P | 6.1 | Instrument sound | 2.4, 5.2, 6.6.7, 14.2, 15.4, 12.13.3 | T04.03 T04.06 T07.05 T14.01 |
| P | 6.2 | Audio mixing | 2.4, 6.5.4, 6.5.7, 6.17.4, 14.2, 15.4, 12.13.3 | T04.02 T04.04 T14.03 T14.07 |
| P | 6.3 | Audio timing | 2.4, 2.5, 6.3.7, 6.4.7, 14.2, 15.4, 12.13.3 | T02.04 T02.05 T02.07 T03.07 T04.04 T05.03 T14.07 |
| P | 7 | 3D stage and visualizer | 2.3, 6.20.4, 6.20.7, 6.21.7, 14.2, 12.9.6, 15.4, 12.13.3 | plus rows P 7.1-7.3 |
| P | 7.1 | Scene quality | 2.3, 6.18.7, 6.21.7, 14.2, 12.9.6, 15.4, 12.13.3 | T05.02 T05.07 T05.09 |
| P | 7.2 | Character animation | 2.3, 6.19.7, 6.20.4, 6.20.7, 14.2, 15.4, 12.13.3 | T05.04 T05.05 T10.02 |
| P | 7.3 | Cameras and stage direction | 2.3, 6.20.4, 6.20.7, 6.21.4, 14.2, 15.4, 12.13.3 | T05.08 |
| P | 8 | Character customization | 6.19.7, 6.22.4, 6.22.7, 7.6.11, 14.2, 15.4, 12.13.3 | T10.01 T10.02 T10.03 T10.04 T10.05 T13.05 |
| P | 9 | Free Play and music theory | 6.2.7, 6.5.7, 6.8.7, 7.6.5, 14.2, 15.4, 12.13.3 | T03.06 T06.01 T06.02 T06.03 T06.04 T06.05 T06.06 |
| P | 10 | Studio and recording | 6.4.7, 6.15.7, 6.17.7, 6.27.7, 14.2, 12.9.7, 15.4, 12.13.3 | T09.02 T09.05 T09.06 T09.07 T09.08 T09.09 T09.10 T09.13 |
| P | 11 | Music import and compatibility | 2.6, 6.3.7, 6.8.7, 8.10.4, 14.2, 15.4, 12.13.3 | T07.02 T07.03 T07.08 T07.09 T08.01 T09.13 T12.03 T12.04 T12.07 T12.08 |
| P | 12 | Dance mode | 6.9.7, 6.20.7, 6.23.1, 10.5.1, 14.2, 15.4, 12.13.3 | T11.02 T11.03 T11.04 T11.05 T11.07 T11.08 T11.09 |
| P | 13 | Multiplayer | 1.4, 2.7, 6.24.7, 6.27.7, 14.2, 15.4, 12.13.3 | T13.02 T13.03 T13.04 T13.05 T13.06 T13.07 T13.08 T13.09 T13.11 |
| P | 14 | Mobile and responsive polish | 6.7.7, 6.18.7, 6.21.7, 10.5.1, 14.2, 12.8, 15.4, 12.13.3 | T01.06 T01.07 T03.02 T03.03 T04.01 T05.01 T14.06 T15.06 |
| P | 15 | Accessibility and interaction details | 6.1.7, 7.10, 10.5.1, 10.5.2, 14.2, 15.4, 12.13.3 | T01.04 T01.07 T05.09 T08.02 T08.03 T08.07 |
| P | 16 | Persistence and project safety | 2.8, 6.10.7, 6.15.1, 6.15.7, 14.2, 12.4.2, 15.4, 12.13.3 | T09.01 T09.03 T09.04 T09.10 T09.11 T09.12 |
| P | 17 | Performance and resource management | 6.18.7, 6.28.7, 9.5, 9.6, 14.2, 15.4, 12.13.3 | T01.03 T05.11 T07.04 T14.01 T14.02 T14.04 T14.05 T14.07 T15.06 |
| P | 18 | Single-file packaging and offline operation | 1.6, 2.1, 2.2, 6.11.7, 14.1, 14.2, 12.8, 15.4, 12.13.3 | T01.02 T13.09 T15.03 T15.04 T16.01 T16.02 T16.05 T16.08 |
| P | 19 | Error handling and recovery | 2.12, 5.11, 6.1.7, 6.14.7, 14.2, 15.4, 12.13.3 | T01.03 T01.04 T01.08 T04.08 T05.01 T07.09 T09.07 T12.06 T13.03 T13.07 T15.01 T15.02 |
| P | 20 | Testing and release quality | 2.2, 2.11, 6.31.7, 14.2, 12.7.4, 15.4, 12.13.3 | T00.06 T03.10 T07.04 T08.08 T09.14 T13.10 T14.07 T15.04 T15.05 T15.07 T16.02 T16.05 T16.06 T16.07 |
| P | 21 | Micro-polish that separates good from excellent | 2.14, 6.26.4, 6.27.4, 9.4.3, 14.2, 15.4 | T01.06 T05.07 T07.08 T07.09 T08.07 T09.10 T09.13 T16.09 |
| P | 22 | Definition of maximum polish | 0.8, 14.2, 12.9.13, 15.4, 12.13.3 | T16.09 |

### A.5 Gaps

None. Every numbered section and subsection of B (1-29), E (1-13), I (1-21) and P (1-22)
has a row above with at least one plan section, and every spec section that has `R-` rows
in Part 15 has at least one T section that covers one of them.

Notes for the coverage critics (these are not gaps; each names where the item is covered):

- B 1.1, B 1.2 and B 1.3 have no `R-` rows in Part 15 (15.1.1 numbers B 1.4 and B 1.5
  only), so they have no AT rows either. They are planning-artifact obligations satisfied by
  this document as a whole (0.2 maps the thirteen B 1.2 artifacts to Parts 2-15) and by
  T00.01, T00.02, T00.04, T00.05, T00.06 and T00.07; the T sections in their rows are
  assigned by content, not read from an R-ID. If the B critic wants matrix rows for them,
  the place to add them is 15.1.1 (Phase 00, method review).
- These parent rows carry no R-IDs of their own, so their T column only points at their
  subsection rows: B 1, 3-21, 23, 25, 26; E 4, 5, 6; I 1, 3, 6, 9, 11, 16; P 2, 5, 7.
- B 4.4 and P 21 contain only P2 rows, so no AT section is listed for them (B 25.7 and
  12.12 and 12.13 require AT tests for P0 and P1 only).
- Part 14 (`14-release.md`) was not yet present in `parts/` when this appendix was drafted;
  its citations (14.1-14.9) use the subsection numbers fixed for Part 14 and must be
  rechecked once Part 14 exists.
- B 27 lists Phase 0 to Phase 16 as unnumbered blocks; they map one-to-one to the Part 11
  phases with the same numbers and to the 11.0 phase-gate table. Likewise the unnumbered
  sub-blocks "Profile A" to "Profile F" (B 8.3), the three experiences (I 10.1), the two
  delivery profiles (I 14.3) and the "Essential improvements" list (I 5) are covered by
  their numbered parent rows.

