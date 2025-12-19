
// DEFAULT CODE
// use helix_db::helix_engine::traversal_core::config::Config;

// pub fn config() -> Option<Config> {
//     None
// }



use bumpalo::Bump;
use heed3::RoTxn;
use helix_macros::{handler, tool_call, mcp_handler, migration};
use helix_db::{
    helix_engine::{
        reranker::{
            RerankAdapter,
            fusion::{RRFReranker, MMRReranker, DistanceMethod},
        },
        traversal_core::{
            config::{Config, GraphConfig, VectorConfig},
            ops::{
                bm25::search_bm25::SearchBM25Adapter,
                g::G,
                in_::{in_::InAdapter, in_e::InEdgesAdapter, to_n::ToNAdapter, to_v::ToVAdapter},
                out::{
                    from_n::FromNAdapter, from_v::FromVAdapter, out::OutAdapter, out_e::OutEdgesAdapter,
                },
                source::{
                    add_e::AddEAdapter,
                    add_n::AddNAdapter,
                    e_from_id::EFromIdAdapter,
                    e_from_type::EFromTypeAdapter,
                    n_from_id::NFromIdAdapter,
                    n_from_index::NFromIndexAdapter,
                    n_from_type::NFromTypeAdapter,
                    v_from_id::VFromIdAdapter,
                    v_from_type::VFromTypeAdapter
                },
                util::{
                    dedup::DedupAdapter, drop::Drop, exist::Exist, filter_mut::FilterMut,
                    filter_ref::FilterRefAdapter, map::MapAdapter, paths::{PathAlgorithm, ShortestPathAdapter},
                    range::RangeAdapter, update::UpdateAdapter, order::OrderByAdapter,
                    aggregate::AggregateAdapter, group_by::GroupByAdapter, count::CountAdapter,
                },
                vectors::{
                    brute_force_search::BruteForceSearchVAdapter, insert::InsertVAdapter,
                    search::SearchVAdapter,
                },
            },
            traversal_value::TraversalValue,
        },
        types::GraphError,
        vector_core::vector::HVector,
    },
    helix_gateway::{
        embedding_providers::{EmbeddingModel, get_embedding_model},
        router::router::{HandlerInput, IoContFn},
        mcp::mcp::{MCPHandlerSubmission, MCPToolInput, MCPHandler}
    },
    node_matches, props, embed, embed_async,
    field_addition_from_old_field, field_type_cast, field_addition_from_value,
    protocol::{
        response::Response,
        value::{casting::{cast, CastType}, Value},
        format::Format,
    },
    utils::{
        id::{ID, uuid_str},
        items::{Edge, Node},
        properties::ImmutablePropertiesMap,
    },
};
use sonic_rs::{Deserialize, Serialize, json};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Instant;
use chrono::{DateTime, Utc};

// Re-export scalar types for generated code
type I8 = i8;
type I16 = i16;
type I32 = i32;
type I64 = i64;
type U8 = u8;
type U16 = u16;
type U32 = u32;
type U64 = u64;
type U128 = u128;
type F32 = f32;
type F64 = f64;
    
pub fn config() -> Option<Config> {
return Some(Config {
vector_config: Some(VectorConfig {
m: Some(16),
ef_construction: Some(128),
ef_search: Some(768),
}),
graph_config: Some(GraphConfig {
secondary_indices: Some(vec!["email".to_string(), "name".to_string()]),
}),
db_max_size_gb: Some(20),
mcp: Some(true),
bm25: Some(true),
schema: Some(r#"{
  "schema": {
    "nodes": [
      {
        "name": "Candidate",
        "properties": {
          "summary": "String",
          "skills": "String",
          "email": "String",
          "embedding": "Array(F64)",
          "id": "ID",
          "label": "String",
          "name": "String"
        }
      },
      {
        "name": "Startup",
        "properties": {
          "label": "String",
          "location": "String",
          "description": "String",
          "funding_stage": "String",
          "funding_amount": "String",
          "embedding": "Array(F64)",
          "id": "ID",
          "industry": "String",
          "name": "String"
        }
      }
    ],
    "vectors": [],
    "edges": [
      {
        "name": "MatchedTo",
        "from": "Candidate",
        "to": "Startup",
        "properties": {
          "matched_at": "String",
          "score": "F64"
        }
      }
    ]
  },
  "queries": [
    {
      "name": "GetAllStartups",
      "parameters": {},
      "returns": [
        "startups"
      ]
    },
    {
      "name": "GetCandidateMatches",
      "parameters": {
        "email": "String"
      },
      "returns": [
        "matches"
      ]
    },
    {
      "name": "AddStartup",
      "parameters": {
        "funding_amount": "String",
        "industry": "String",
        "embedding": "Array(F64)",
        "description": "String",
        "funding_stage": "String",
        "name": "String",
        "location": "String"
      },
      "returns": [
        "startup"
      ]
    },
    {
      "name": "AddCandidate",
      "parameters": {
        "email": "String",
        "embedding": "Array(F64)",
        "name": "String",
        "summary": "String",
        "skills": "String"
      },
      "returns": [
        "candidate"
      ]
    },
    {
      "name": "GetCandidateByEmail",
      "parameters": {
        "email": "String"
      },
      "returns": [
        "candidate"
      ]
    }
  ]
}"#.to_string()),
embedding_model: Some("text-embedding-ada-002".to_string()),
graphvis_node_label: None,
})
}

pub struct Candidate {
    pub email: String,
    pub name: String,
    pub summary: String,
    pub skills: String,
    pub embedding: Vec<f64>,
}

pub struct Startup {
    pub name: String,
    pub industry: String,
    pub description: String,
    pub funding_stage: String,
    pub funding_amount: String,
    pub location: String,
    pub embedding: Vec<f64>,
}

pub struct MatchedTo {
    pub from: Candidate,
    pub to: Startup,
    pub score: f64,
    pub matched_at: String,
}


#[derive(Serialize)]
pub struct GetAllStartupsStartupsReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub name: Option<&'a Value>,
    pub embedding: Option<&'a Value>,
    pub industry: Option<&'a Value>,
    pub location: Option<&'a Value>,
    pub description: Option<&'a Value>,
    pub funding_stage: Option<&'a Value>,
    pub funding_amount: Option<&'a Value>,
}

#[handler]
pub fn GetAllStartups (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let startups = G::new(&db, &txn, &arena)
.n_from_type("Startup").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "startups": startups.iter().map(|startup| GetAllStartupsStartupsReturnType {
        id: uuid_str(startup.id(), &arena),
        label: startup.label(),
        name: startup.get_property("name"),
        embedding: startup.get_property("embedding"),
        industry: startup.get_property("industry"),
        location: startup.get_property("location"),
        description: startup.get_property("description"),
        funding_stage: startup.get_property("funding_stage"),
        funding_amount: startup.get_property("funding_amount"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetCandidateMatchesInput {

pub email: String
}
#[derive(Serialize)]
pub struct GetCandidateMatchesMatchesReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub name: Option<&'a Value>,
    pub embedding: Option<&'a Value>,
    pub industry: Option<&'a Value>,
    pub location: Option<&'a Value>,
    pub description: Option<&'a Value>,
    pub funding_stage: Option<&'a Value>,
    pub funding_amount: Option<&'a Value>,
}

#[handler]
pub fn GetCandidateMatches (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetCandidateMatchesInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let candidate = G::new(&db, &txn, &arena)
.n_from_index("Candidate", "email", &data.email).collect_to_obj()?;
    let matches = G::from_iter(&db, &txn, std::iter::once(candidate.clone()), &arena)

.out_node("MatchedTo").collect::<Result<Vec<_>, _>>()?;
let response = json!({
    "matches": matches.iter().map(|matche| GetCandidateMatchesMatchesReturnType {
        id: uuid_str(matche.id(), &arena),
        label: matche.label(),
        name: matche.get_property("name"),
        embedding: matche.get_property("embedding"),
        industry: matche.get_property("industry"),
        location: matche.get_property("location"),
        description: matche.get_property("description"),
        funding_stage: matche.get_property("funding_stage"),
        funding_amount: matche.get_property("funding_amount"),
    }).collect::<Vec<_>>()
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AddStartupInput {

pub name: String,
pub industry: String,
pub description: String,
pub funding_stage: String,
pub funding_amount: String,
pub location: String,
pub embedding: Vec<f64>
}
#[derive(Serialize)]
pub struct AddStartupStartupReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub name: Option<&'a Value>,
    pub embedding: Option<&'a Value>,
    pub industry: Option<&'a Value>,
    pub location: Option<&'a Value>,
    pub description: Option<&'a Value>,
    pub funding_stage: Option<&'a Value>,
    pub funding_amount: Option<&'a Value>,
}

#[handler]
pub fn AddStartup (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<AddStartupInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let startup = G::new_mut(&db, &arena, &mut txn)
.add_n("Startup", Some(ImmutablePropertiesMap::new(7, vec![("name", Value::from(&data.name)), ("industry", Value::from(&data.industry)), ("embedding", Value::from(&data.embedding)), ("funding_amount", Value::from(&data.funding_amount)), ("description", Value::from(&data.description)), ("location", Value::from(&data.location)), ("funding_stage", Value::from(&data.funding_stage))].into_iter(), &arena)), Some(&["name"])).collect_to_obj()?;
let response = json!({
    "startup": AddStartupStartupReturnType {
        id: uuid_str(startup.id(), &arena),
        label: startup.label(),
        name: startup.get_property("name"),
        embedding: startup.get_property("embedding"),
        industry: startup.get_property("industry"),
        location: startup.get_property("location"),
        description: startup.get_property("description"),
        funding_stage: startup.get_property("funding_stage"),
        funding_amount: startup.get_property("funding_amount"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct AddCandidateInput {

pub name: String,
pub email: String,
pub summary: String,
pub skills: String,
pub embedding: Vec<f64>
}
#[derive(Serialize)]
pub struct AddCandidateCandidateReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub name: Option<&'a Value>,
    pub summary: Option<&'a Value>,
    pub email: Option<&'a Value>,
    pub skills: Option<&'a Value>,
    pub embedding: Option<&'a Value>,
}

#[handler]
pub fn AddCandidate (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<AddCandidateInput>(&input.request.body)?;
let arena = Bump::new();
let mut txn = db.graph_env.write_txn().map_err(|e| GraphError::New(format!("Failed to start write transaction: {:?}", e)))?;
    let candidate = G::new_mut(&db, &arena, &mut txn)
.add_n("Candidate", Some(ImmutablePropertiesMap::new(5, vec![("skills", Value::from(&data.skills)), ("email", Value::from(&data.email)), ("summary", Value::from(&data.summary)), ("embedding", Value::from(&data.embedding)), ("name", Value::from(&data.name))].into_iter(), &arena)), Some(&["email"])).collect_to_obj()?;
let response = json!({
    "candidate": AddCandidateCandidateReturnType {
        id: uuid_str(candidate.id(), &arena),
        label: candidate.label(),
        name: candidate.get_property("name"),
        summary: candidate.get_property("summary"),
        email: candidate.get_property("email"),
        skills: candidate.get_property("skills"),
        embedding: candidate.get_property("embedding"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}

#[derive(Serialize, Deserialize, Clone)]
pub struct GetCandidateByEmailInput {

pub email: String
}
#[derive(Serialize)]
pub struct GetCandidateByEmailCandidateReturnType<'a> {
    pub id: &'a str,
    pub label: &'a str,
    pub name: Option<&'a Value>,
    pub summary: Option<&'a Value>,
    pub email: Option<&'a Value>,
    pub skills: Option<&'a Value>,
    pub embedding: Option<&'a Value>,
}

#[handler]
pub fn GetCandidateByEmail (input: HandlerInput) -> Result<Response, GraphError> {
let db = Arc::clone(&input.graph.storage);
let data = input.request.in_fmt.deserialize::<GetCandidateByEmailInput>(&input.request.body)?;
let arena = Bump::new();
let txn = db.graph_env.read_txn().map_err(|e| GraphError::New(format!("Failed to start read transaction: {:?}", e)))?;
    let candidate = G::new(&db, &txn, &arena)
.n_from_index("Candidate", "email", &data.email).collect_to_obj()?;
let response = json!({
    "candidate": GetCandidateByEmailCandidateReturnType {
        id: uuid_str(candidate.id(), &arena),
        label: candidate.label(),
        name: candidate.get_property("name"),
        summary: candidate.get_property("summary"),
        email: candidate.get_property("email"),
        skills: candidate.get_property("skills"),
        embedding: candidate.get_property("embedding"),
    }
});
txn.commit().map_err(|e| GraphError::New(format!("Failed to commit transaction: {:?}", e)))?;
Ok(input.request.out_fmt.create_response(&response))
}


