import { redirect } from 'next/navigation';

/** The app has one home, and it is the till. */
export default function Home() {
  redirect('/mauzo');
}
