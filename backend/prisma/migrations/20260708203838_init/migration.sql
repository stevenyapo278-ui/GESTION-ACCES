-- RenameForeignKey
ALTER TABLE "cell_values" RENAME CONSTRAINT "fk_cell_value_assignee" TO "fk_cell_value_owner";

-- RenameForeignKey
ALTER TABLE "cell_values" RENAME CONSTRAINT "fk_cell_value_owner" TO "fk_cell_value_assignee";
