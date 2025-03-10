Reactivity -- What should we track for cell automatic re-computation upon modifications? 

Rerun: Must run modified cell to activate reactivity. No realtime as we modify. 

**What we for sure want to support:** 
- Primitive variables (int, string, bool ...): 
``` 
c1: a = 3  # upon changing this cell & rerunning it .. 
c2: b = a + 1  # this cell should rerun 
```
- Any data structures (arrays, objects ...): 
``` 
c1: a = [1,2,3]  
c2: a[2] = 4  # upon changing this cell & rerunning it .. 
c3: b = a[2] + 1  # this cell should rerun 
```
- Functions 
```
c1: add(4) # this should rerun (see below) 
c2: def add (a) => a + 3 # upon changing function (i.e. 4 instead of 3).. 
c3: def call_add() => add(3) # this should rerun 
``` 
- For the above, cells may be in any order, so we don't really have a notion of top-to-bottom execution order. 

**What we may want to support:** 
- Class definitions: 
``` 
c1: class Mushroom:
        def __init__(self, found_in, is_toxic):
            self.location = found_in # what if we change the init method? => c2 should rerun => c3 should rerun
            self.is_toxic = is_toxic
    
        def mark_toxic(self):
            self.is_toxic = True # modify this class method  => c3 should rerun 
c2: enoki = Mushroom(fridge, False) # This only gets rerun upon init method changes
c3: enoki.mark_toxic() # this cell should rerun upon method changes only 
```
- This gets complicated as we may have nested functions in the `__init__` method... 

**What is beyond the scope:**
- Redefinition of global variables: Introduces complicated circular dependencies 
