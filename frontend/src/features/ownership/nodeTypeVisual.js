import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import HandshakeIcon from '@mui/icons-material/Handshake';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import GroupsIcon from '@mui/icons-material/Groups';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

/**
 * One colour and one glyph per owner type, in one place.
 *
 * <p>Both the Add owner picker and the ownership tree read from here, so the disc someone chooses
 * is the disc they then see in the structure. Two tables would drift, and a type that looks like
 * one thing in the picker and another in the tree is worse than no colour at all.
 *
 * <p>Icons are stored as component references rather than elements, which keeps this file free of
 * JSX and lets each caller size the glyph for its own context — 20px in a tree row, 26px on a card.
 *
 * <p>Where two types would otherwise share a family of glyph, the glyph is what changes: colour
 * alone is no answer for anyone who cannot separate teal from lime. A listed company is the one
 * that is traded; a limited partnership is the one with a partner standing behind another.
 */
export const NODE_VISUAL = {
  INDIVIDUAL:           { hue: '#F59E0B', Icon: PersonIcon },
  PRIVATE_COMPANY:      { hue: '#6366F1', Icon: BusinessIcon },
  LISTED_COMPANY:       { hue: '#0EA5E9', Icon: ShowChartIcon },
  TRUSTEE_COMPANY:      { hue: '#A855F7', Icon: ShieldOutlinedIcon },
  TRUST:                { hue: '#F43F5E', Icon: AccountBalanceIcon },
  PARTNERSHIP:          { hue: '#10B981', Icon: HandshakeIcon },
  LIMITED_PARTNERSHIP:  { hue: '#0D9488', Icon: SupervisorAccountIcon },
  INCORPORATED_SOCIETY: { hue: '#65A30D', Icon: GroupsIcon },
  CHARITY:              { hue: '#EC4899', Icon: VolunteerActivismIcon },
  // The two neutrals sit on the two types that are nobody's commercial venture.
  GOVERNMENT_AGENCY:    { hue: '#475569', Icon: FlagOutlinedIcon },
  DECEASED_ESTATE:      { hue: '#78716C', Icon: HistoryEduIcon },

  // Not offered in the picker, but still drawn: nodes stored as one of these predate the change.
  OTHER:                { hue: '#64748B', Icon: HelpOutlineIcon },
  // Superseded by PRIVATE_COMPANY in V34.
  NZ_COMPANY:           { hue: '#6366F1', Icon: BusinessIcon },
};

const FALLBACK = { hue: '#64748B', Icon: HelpOutlineIcon };

export const visualFor = (nodeType) => NODE_VISUAL[nodeType] ?? FALLBACK;

/**
 * The disc's fill: the type's own hue, barely there.
 *
 * <p>An alpha of the hue rather than a second, lighter hex — the fill then sits on whatever is
 * behind it, so one table serves both light and dark mode. A fixed pastel would glow on a dark
 * tile.
 */
export const tintOf = (hue) => `${hue}1F`;
