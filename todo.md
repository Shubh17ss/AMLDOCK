1. Correction in deal verification constraints - A deal can be moved to verified without having any
   owners in it - currently it is considered while moving deal to verified.

2. In Property details drawer - the input current ownership tenure to have another option as button that 
   would decide the value. Button - 'To be Confirmed' separated by or btw year and months input section.
   Either user chooses this or types in years,months. Add 3 to risk rating if this button(not sure if it should be called a button but something like that- that highlights upon selecting) is selected. Change 
   input text for Property Value to APPRAISED VALUE. Also in the property drawer remove Audti trail (we don't need to show that)

3. Where ever we are capturing date or showing date - change format from mm/dd/yyyy to dd/mm/yyyy - feel 
   free to delete entries if there are issues making this change.


4. In assurance component - add date range inputs beside property search input. These inputs would act as 
   range of date in which the deals have to be fetched based on the date they got verified and the date they got closed. Since we are fetching by versions we can apply that on version level itself. Remove DEAl column from row replace with Last Updated . Remove column signed off - replace with Last Updated - show date and time hh:mm.

5. The assurance state of deals to be changed to : Assured, Action Required (red), not reviewed. A not 
   reviewed deal could be moved to assured or Action required. No need to capture notes when moving to
   assured. In case of Action required - a dialogue asking for Identified issue and Remediation as separate
   inputs where adding this would add single row and more issue and respective remediation could be added.
   Refer image.png for design and better understanding of dialogue box. Marking a action required deal to assured would remove all those issues.



 