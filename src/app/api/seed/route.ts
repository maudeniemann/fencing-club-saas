import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const coaches = [
  'Alex Kushkov',
  'Anya Kushkov',
  'Ben Kushkov',
  'Dima Kosmin',
  'Lukas Eichhorn',
  'Harrison Hue',
  'Eva Jelison',
];

const players = [
  'Jake Nest','Zigmas Rimas','Shankar Aeron','Amina Aguzarova','William Ajami',
  'Gabby Akhiezer','Luara Alfano','Galina Almeda','Stanislav Almeda','Angel An',
  'Marcus An','Maksim Arefolov','Boris Aronchik','Emily Ata','Kevin Ata',
  'Awal Atchade','Eva Bachman','Gordon Badrak','Elliott Barbarisi','Eli Baron',
  'Andy Baumel','Sara Berinhout','Katerina Berry','Arya Bhargava','Ekam Bhatia',
  'Edward Biffi','Sophia Bililies','Max Binshtok','Hanna Blyakhman','Emme Bograd',
  'Caleb Bor Parrilla','Gideon Boroff','Zachary Bouzari','Leo Bratnikov',
  'Daniel Butovsky','Jeff Cai','James Carpinter Cobey','Cyrus Casas Adler',
  'Kai Champagne','Sebastian Chan','Mia Chao','Jai Chauhan','Albert Chen',
  'Brian Chen','Mark Chen','Bradley Chernobylsky','Clayton Choi','Alex Chterental',
  'Angeline Chui','Madeline Church','Alex Ciccarone','Cal Clark','Roy Cotton',
  'Casey Cox','Stefan Craciun','Yahya Dadras','Clark Daly','Veronika Danylchenko',
  'Michael Danylevskyi','Nazarii Dobrynchuk','Maddy Dolgin','Beatrice Dolsak',
  'Jack Dolsak','Oscar Dolsak','Roman Dolsak','Angel Dong','Tatiana Egorova',
  'Peter Engel','Alysa Evdokimov','Wesley Halliwell','Jonathan Hamill',
  'Pedram Hamrah','Rachel Harelick','Daniel Hazan','Viviana Hazan',
  'Cameron Hoffmeister','Aiden Hsu','Naomi Hsu','Anthony Huang','Chris Huang',
  'Connor Huang','Enoch Huang','Jessi Huang','Max Huang','Max Hurowitz',
  'Akea Ishikawa','Polina Ivanova','Lori Jackson','Eitan Jacobs','Ali Jafri',
  'Yoonji Jang','Uma Jay','Grayson Jeon','Hazard Jeon','Jeremy Jin','Jack Johnsen',
  'James Johnsen','Lily Johnson','Aaryan Joseph','Tim Kalashnikov','Ellie Kang',
  'Evan Kang','Ayesha Kapoor','Sasha Kaufman-Sharp','Katie Keith','Anne Kelley',
  'Amelia Kessler','Nathan Kessler','Mark Khazhinsky','Alexander Khotline',
  'Daniel Khotline','Benjamin Kim','Chan Kim','Meir Klebaner','Eva Klebaner',
  'Benjamin Knobel','Sophia Knobel','Ayla Kobi','Jacob Kogan','Simon Kogan',
  'Ester Konnikov','David Koren','George Koren','Vanya Kosmin','Sasha Kosmina',
  'Dasha Koval','Aiden Kovtun','Misha Kravchuk','Max Kravchuk','Sophia Kritz',
  'Arjun Kumar','Avinash Kumar','Matthew Kunin','Benjamin Kuritnik',
  'Sarah Kuritnik','Daniel Kushkov','Michael Kushkov','Simon Kushkov',
  'Veniamin Kushkov','Polina Kuznetsov-Kaufman','Miriam Lagoon','Isabel Laguio',
  'Isabella Laird','Shelby Laird','Jae Lee','Maxwell Lee','Ryan Lee','Subin Lee',
  'Emily Lefeber','Peter Lefeber','Maksim Legostaev','Benjamin Levin',
  'Etan Levitan','Taleb Lienau-Rana','Craig Lillehei','Alex Lin','Andrew Liu',
  'Ray Liu','James Lo','Isaac Lorch','Liza Lubarsky','Leung Luke',
  'Ishwar Madhusudan','Gia Magitsky','Isaac Magitsky','Leila Magitsky',
  'David Maklin','Eddie Maklin','Sofia Maklin','Paolo Maldonado','Kevin March',
  'Masha Margulian','Bryce Marmer','Yoav Marom','Solomiya Martynov',
  'Francis McAlister','Daniel Medvinsky','Sasha Medvinsky','Anya Mehta',
  'Lars Middelbeek','Maarten Middelbeek','Poppy Middien','Thomas Middien',
  'Natalia Mikhaylov','Aaron Mitchell-Katz','Arina Mitropolsky','Emily Morgan',
  'Molly Morgan','Sophia Morgan','Masha Motov','Max Motov','Yevgeniy Motov',
  'Henry Murphy','Jacob Murray','Ethan Murray','Andrew Murry','Sammy Nathanson',
  'Katerina Nedopaka','Elyse Nelson','Cooper Neufeld','Noa Orkand','Kyrylo Orlov',
  'Sophia Palacios','Liz Angela Palomino Flores','Arseny Panfilov','Artem Panfilov',
  'Ben Parker','Alexey Pashin','Andrey Pashin','Anya Pashin','Arush Patel',
  'Kristina Paul','Meira Paul','Leonina Penn','Uma Peri','Brooks Petro-Gelman',
  'Asher Pietrzyk','Avishai Polat','Nunila Porres','Oton Porres','Daniel Portnoy',
  'Elizabeth Portnoy','Misha Postnikov','Vail Pourchot','Stepan Prokopenko',
  'Leeza Prozunent','Michael Ptushkin','Nicoletta Ptushkina','Arina Pukhlyak',
  'Morgan Puritz','Albert Qiu','Emily Qiu','Shea Randall-Collins','Caolan Rayan',
  'Ryan Raymond','Sreemayi Reddy','Alice Rekhtman','Oliver Reynolds','Ezra Richter',
  'Kellan Rietdyk','Avi Rifkin','Caleb Rifkin','Lana Rifkin','Lielle Rifkin',
  'Talia Rifkin','Eddie Risman','Darshan Riveratan','Teddy Rodriguez','Cat Row',
  'Dmytro Rozghon','Ezra Ruchter','Danielle Rumshisky','Viktor Rybnikov',
  'Olya Sadova','Jacob Sakayeda','John Sanders','Gabriel Sanieoff',
  'Jennifer Schild','Calum Scott','Isabelle Semenov','Nikita Serbin','Cindy Shan',
  'Molly Shan','Joseph Shangin','Simon Shapiro','Aidan Shatz','Lili Shen',
  'Mikhail Shimshovich','Alex Shipitsin','Sasha Shirpal','Arjun Shivdasani',
  'Leah Shtokman','Leora Shtokman','Ava Shtokman','Maria Shtrevensky',
  'Michael Shulkin','Olivia Silchukova','Sumair Singh','Alessandra Sirotin',
  'Rohan Sita','Victor Slabodchikov','Andrew Slastin','Isaac Sobolewski',
  'Aarav Somani','Anika Somani','Theo Song','Anishka Srikanth','Ben Stolarov',
  'Withrop Storm','Ivy Su','Rhea Sugarman','Siobhan Sullivan','Azi Suppappola',
  'Mila Suppappola','Evan Suppappola','Anna Suvorova','Aaron Taycher','Tri Thach',
  'Kobe Thomson','Alex Thys','Matthias Thys','Smith Tobin','Lev Tolstov',
  'Philip Tomov','Anastasia Tsvetkova','Diana Uglova','Utku Ulu','Benjamin Utin',
  'Ibla Vadasz','Alexandra Valdez','Rodrigo Vallejo-Izquierdo','Ari Vaysberg',
  'Aaron Velinzon','Ezra Ventura','David Vidrevich','Nadia Viola','Nasko Viola',
  'Ekam Vohra','Puja Vohra','Victoria Von Hehn','Raphael Vranceanu','Avi Vysetty',
  'Jonathan Walker','Carol Wang','Charlotte Wang','Daniel Wang','Edward Wang',
  'Frank Wang','Jason Wang','Kelly Wang','Muzhou Wang','Nelson Wang',
  'Elliot Fayne','David Figelman','Maya Figelman','Anya Filatov','Sophia Fomin',
  'Gabriel Forman','Alex Fossey','Robin Freewomen','Nathaniel Friedberg',
  'Avery Frieze','Noah Frost','Beatrice Fry','Edward Fry','Oliver Gacs',
  'Elliot Gao','Sebastian Garcia','Tempest Garcia','Nathan Garland',
  'Antonio Gaytan','Max Gershberg','Eli Gertsberg','Ari Gilbert','Alex Glekel',
  'Olivia Glik','Corwin Goldmacher','Emma Goldman','Luke Gomberg',
  'Sophia Goncharov','Lillian Gordon','Roman Gorokhov','Romi Gorokhov',
  'Lincoln Goulet','Walker Graham','Camila Griffin','Rogan Grove','Arthur Guan',
  'Lucas Gupta','Oona Hall',
];

function nameToEmail(name: string, index: number): string {
  const clean = name
    .toLowerCase()
    .replace(/[^a-z\s-]/g, '')
    .trim()
    .replace(/\s+/g, '.');
  return `${clean}.${index}@seed.fencing-club.local`;
}

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify admin
    const { data: member } = await supabase
      .from('club_members')
      .select('id, club_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!member || member.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const admin = createAdminClient();
    const clubId = member.club_id;
    let coachCount = 0;
    let playerCount = 0;
    const errors: string[] = [];

    // Seed coaches
    for (let i = 0; i < coaches.length; i++) {
      const name = coaches[i];
      const email = nameToEmail(name, i);
      try {
        const { data: authUser, error: authError } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: name },
        });
        if (authError) {
          errors.push(`Coach auth ${name}: ${authError.message}`);
          continue;
        }
        const { error: memberError } = await admin.from('club_members').insert({
          club_id: clubId,
          user_id: authUser.user.id,
          role: 'coach',
          display_name: name,
          commission_rate: 0.70,
          specialties: ['epee', 'foil', 'sabre'],
        });
        if (memberError) {
          errors.push(`Coach member ${name}: ${memberError.message}`);
          continue;
        }
        coachCount++;
      } catch (e) {
        errors.push(`Coach ${name}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    // Seed players in batches
    for (let i = 0; i < players.length; i++) {
      const name = players[i];
      const email = nameToEmail(name, i + 1000);
      try {
        const { data: authUser, error: authError } = await admin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { full_name: name },
        });
        if (authError) {
          errors.push(`Player auth ${name}: ${authError.message}`);
          continue;
        }
        const { error: memberError } = await admin.from('club_members').insert({
          club_id: clubId,
          user_id: authUser.user.id,
          role: 'player',
          display_name: name,
        });
        if (memberError) {
          errors.push(`Player member ${name}: ${memberError.message}`);
          continue;
        }
        playerCount++;
      } catch (e) {
        errors.push(`Player ${name}: ${e instanceof Error ? e.message : 'unknown'}`);
      }
    }

    return NextResponse.json({
      success: true,
      coaches_created: coachCount,
      players_created: playerCount,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal error' }, { status: 500 });
  }
}
