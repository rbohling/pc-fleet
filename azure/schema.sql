CREATE TABLE dbo.FleetState (
  id int NOT NULL PRIMARY KEY CHECK (id = 1),
  payload nvarchar(max) NOT NULL CHECK (ISJSON(payload) = 1),
  revision int NOT NULL
);
INSERT INTO dbo.FleetState (id,payload,revision)
VALUES (1,N'{"assets":[],"events":[],"revision":0}',0);
