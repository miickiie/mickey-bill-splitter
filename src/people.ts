import type {Person} from './types';

export function shouldReplaceStarterPerson(
  people: Person[],
  defaultPersonNames: string[],
) {
  if (people.length !== 1) return false;

  const starterPerson = people[0];
  const hasPlates = starterPerson.plates
    ? Object.values(starterPerson.plates).some(count => count > 0)
    : false;

  return (
    starterPerson.id === '1'
    && defaultPersonNames.includes(starterPerson.name)
    && starterPerson.items.length === 0
    && starterPerson.individualDiscount === 0
    && !hasPlates
  );
}
