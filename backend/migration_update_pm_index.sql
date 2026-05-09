-- Migration Script: Move 'Assign project manager' completions from index 4 to 3
-- Run this on your PRODUCTION database when deploying the code changes.

UPDATE IGNORE lead_task_completions 
SET milestone_index = 3 
WHERE task_name = 'Assign project manager' AND milestone_index = 4;

DELETE FROM lead_task_completions 
WHERE task_name = 'Assign project manager' AND milestone_index = 4;
