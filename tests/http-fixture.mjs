// Isolated route tests explicitly supply the Host authentication seam. Tests
// of unauthorized access use a rejecting service or no service instead.
export const authenticatedTestContext={get:name=>name==='connection'?{requestRejection:()=>undefined}:undefined};
