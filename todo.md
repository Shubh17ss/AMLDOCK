1.  Verification tab of each owner type work:
    Remove everything that's currently there. Just need 2 tabs inside it - Verification and Verification (Exception) - Refer image.png(in root dir) for design. No need of voice notes - Notes textarea box shown only  when Verification(Exception) tab is selected. Just have 2 buttons Close and Verify(this would basically save the selected information). If the owner is already verified show that before the question itself along with the name of person verifying it with time and date of verification. However, this could be overridden by verifying with different option again.
    The row for each user in ownership structure tab - show should show 'Not Verified' (in red), Verified(in green), <Alert logo>Verified(green) if verified with exception.

2. On the previous point we just worked - owners regardless of the deals in that branch should be added in /cdd-exceptions route name, type of owner, verified date, property address (link to respective deal) - refer route /beneficial-owners for component layout. 

3. In Property type input in property details tab (property drawer) add another type : Development
and the corresponding Reason for selling - 
Residential Building, Townhouses, Commercial Building, Integrated Residential Project, Mixed Use Development, Subdivision, Standalone Home
