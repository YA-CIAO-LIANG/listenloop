/**
 * Feature switches. Turning a feature off hides it everywhere (and its
 * pages answer 404) without deleting its code.
 */

/**
 * M2.5 aquarium rewards: points and feed in the header, "earned …" lines
 * on completion screens, the fish shop and My fish, and the pixel fish on
 * /styleguide. Paused on 2026-10-28: the learner doesn't want the
 * gamified direction (see docs/aquarium.md).
 */
export const AQUARIUM_ENABLED = false;

/**
 * Practices from a pasted YouTube link (D97, D129). Paused on 2026-11-11
 * (D131): hidden on the create page, the plan comparison, the user
 * manual, the interest page's sources, and the setup check and
 * connection test, and the server actions refuse it. Practices already
 * made from a link still play, and built-in YouTube videos (the Blender
 * open movies) don't use this at all. Set to true to bring it back.
 */
export const YOUTUBE_LINK_PRACTICES_ENABLED = false;
