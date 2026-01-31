import axios from "axios";
import { credentials } from "./credentials";

const pullRequestDataCache = {};

function getCacheKey(repository, prNumber) {
    return `${repository}|${prNumber}`;
} 

export async function getPullRequestData(repository, prNumber): Promise<Array<any>> {
    const cacheKey = getCacheKey(repository, prNumber);
    if(pullRequestDataCache[cacheKey]) return pullRequestDataCache[cacheKey];
    const graphqlQuery = `
    query {
        repository(name: "${repository}" owner: "squareup") {
          pullRequest(number: ${prNumber}) {
            reviews(first: 50) {
              edges {
                node {
                  id
                  body
                  url
                  author {
                    login
                  }
                  publishedAt
                  reactions(first:5) {
                    edges {
                      node {
                        id
                        content
                        user {
                          login
                        }
                      }
                    }
                  }
                  comments(first:20) {
                    edges {
                      node {
                        id
                        body
                        author {
                          login
                        }
                        reactions(first:5) {
                          edges {
                            node {
                              id
                              content
                              user {
                                login
                              }
                            }
                          }
                        }
                        url
                      }
                    }
                  }
                }
              }
            }
          }
        }
        rateLimit {
          cost
        }
      }
    `
    const response = await axios.post(
        `https://api.github.com/graphql`, {
            query: graphqlQuery
        }, credentials
    );
    const reviewData = response.data.data.repository.pullRequest.reviews.edges;
    pullRequestDataCache[cacheKey] = reviewData;
    return reviewData;
}

