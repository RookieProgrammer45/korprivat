-- Identity context: persist driving-school owners as Role.SCHOOL.
-- Postgres 12+ allows ADD VALUE inside a transaction.
ALTER TYPE "Role" ADD VALUE 'SCHOOL';
