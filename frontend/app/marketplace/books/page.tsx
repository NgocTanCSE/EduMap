import { redirect } from 'next/navigation';

/**
 * The dedicated books page duplicated the share marketplace with dead
 * controls. Keep the URL working by sending visitors to the same catalogue
 * with the book filter preselected.
 */
export default function BookMarketplacePage() {
  redirect('/marketplace?category=book');
}
