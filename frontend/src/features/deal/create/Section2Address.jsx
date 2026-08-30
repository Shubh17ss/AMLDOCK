import { AddressFinderField } from '../../../components/AddressFinderField.jsx';
import { useFirmCountry } from '../../../hooks/useFirmCountry.js';
import { SectionCard, FieldGroup } from './SectionShell.jsx';

/**
 * Section 2 — the address, and nothing else.
 *
 * This is the section that creates the deal. It asks for one thing because that is the least a
 * deal can be identified by: with a client role and an address there is a real record to come
 * back to, and everything after it can be filled in over however many sittings it takes. The
 * broker standing outside a property can start the file in the time it takes to type it.
 */
export function Section2Address({ form, setGroup }) {
  // Which address database to search. A resumed deal already carries the country the server
  // stamped on its property — prefer it, because the deal's own reporting entity is the
  // authority, not whoever happens to be looking at it.
  const { country: firmCountry } = useFirmCountry();
  const country = form.property.country || firmCountry;

  return (
    <SectionCard
      title="The property"
      subtitle="The address is all we need to open the file — everything else can follow."
    >
      <FieldGroup title="Address">
        <AddressFinderField
          value={form.property}
          onChange={setGroup('property')}
          country={country}
        />
      </FieldGroup>
    </SectionCard>
  );
}
